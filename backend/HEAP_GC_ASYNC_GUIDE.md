# Heap Allocation, Garbage Collection, and Long Async Process Safety — Backend

This document explains how heap allocation and garbage collection (GC) currently interact with the backend, how the codebase attempts to keep heap usage under control, its reliability for long-running asynchronous processes, known risks, and concrete recommendations and mitigations.

Key code reference
- Main observed implementation: [backend/src/main/java/com/amarvote/amarvote/service/PartialDecryptionService.java](backend/src/main/java/com/amarvote/amarvote/service/PartialDecryptionService.java)

Summary of current behavior (observed)
- Memory-efficient design patterns are intentionally used in `PartialDecryptionService`:
  - Fetch minimal data (IDs only) up front: repository calls that return only election center IDs.
  - Load per-chunk data on demand and discard after use (per-election-center fetch inside loops).
  - Clear strong references to large objects immediately after use (set variables to `null`, call `clear()` on lists).
  - Explicit calls to `System.gc()` and brief `Thread.sleep()` waiting after GC attempts (two GC passes per chunk and per compensated chunk).
  - Periodic memory logging every 10 chunks to track heap usage.
  - Async processing avoids retaining a Hibernate session across the whole async method (comment: `@Transactional removed from async method to prevent Hibernate session memory leak`).
  - Per-chunk transactional boundaries are used (each chunk processed in its own transaction / helper that creates a short-lived persistence context).
  - Status-tracking persisted to DB (`DecryptionStatus`, `CombineStatus`) so progress state is not kept in-memory for long-running jobs.
  - Concurrency safeguards via in-memory locks: `decryptionLocks` and `combineLocks` (ConcurrentHashMap), to prevent duplicate concurrent runs for same guardian/election.

Why these patterns matter
- Streaming/ID-based fetching avoids loading all election centers / ballots into memory at once.
- Clearing references and freeing collections reduces live object retention so GC can reclaim them.
- Short transactional scopes prevent Hibernate from accumulating managed entities in the persistence context.
- Persisted progress lets long running work be resumed/observed without keeping large state in RAM.

Reliability assessment (how reliable is current GC/heap clearing?)
- Positive points
  - The code follows many best-practices for large-batch processing: per-chunk fetch, immediate nulling of large objects, and per-chunk DB transactions.
  - Status updates are persisted, reducing need for in-memory bookkeeping across long runs.
  - Locking and finally blocks release in-memory locks reliably.
- Limitations / concerns
  - Calls to `System.gc()` are only *suggestions* to the JVM — the JVM may ignore them or behave non-deterministically. Relying on `System.gc()` for correctness or predictability is not recommended.
  - Frequent `System.gc()` + `Thread.sleep()` (300ms) per chunk can cause unpredictable pauses and throughput degradation under load.
  - Using many large Strings (e.g., concatenated ciphertexts, big JSON payloads) still increases pressure on the heap; nulling references helps but does not guarantee immediate reclamation.
  - If any strong reference remains (e.g., static caches, accidentally retained objects, open streams, or JPA-managed entities that are not detached), GC cannot reclaim memory.
  - The default Spring `@Async` executor (if not explicitly bounded) can spawn many threads and contribute to memory pressure and OOM risk.
  - In Docker environments, JVM memory limits need to be set explicitly. Without tuned -Xmx flags, the container may be killed by the OOM killer or run into host-level resource issues.

Specific risks in `PartialDecryptionService` (observed patterns)
- Reliance on explicit System.gc(): unpredictable and may hurt performance.
- Potential reloading of some data repeatedly (e.g., reading electionChoiceRepository repeatedly inside inner loops) may cause DB and allocation overhead.
- Large JSON or String payloads (ciphertext, ballot arrays) are built in-memory and passed to microservice calls — large payloads can spike heap usage.
- Repeated creation of new lists and large responses from microservice parsing create transient garbage spikes.
- No explicit `entityManager.clear()` observed after saving per-chunk entities (unless `processChunkTransactional()` detached entities). This can leave managed references alive if not careful.

Concrete recommendations (short-term, medium-term, long-term)

Short-term (low-effort, high-impact)
- Remove or reduce `System.gc()` calls. Prefer to rely on tuned GC or call GC only in exceptional failure-handling paths.
- Replace repeated `Thread.sleep(300)` after GC with no sleep or instrumented wait only for diagnostics: sleeping is not a reliable way to make garbage collection complete.
- Ensure per-chunk DB transactions explicitly detach/clear persistence context after chunk is saved. E.g., call `entityManager.clear()` at the end of a chunk transaction to ensure Hibernate-managed objects are eligible for GC.
- Avoid repeated repository calls inside inner loops: preload constant lists once (candidate/party names) and reuse local copies.
- Stream submitted ballots using pagination or repository methods that support streaming (e.g., Spring Data's Stream or slicing) to avoid collecting all into a list when not necessary.

Medium-term (moderate effort)
- Configure a bounded `ThreadPoolTaskExecutor` for Spring `@Async` processing with a limited queue and rejection policy. This prevents unbounded thread growth and throttles concurrency:

  - Example bean (Spring):

  ```java
  @Bean(name = "taskExecutor")
  public ThreadPoolTaskExecutor taskExecutor() {
      ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
      executor.setCorePoolSize(2);
      executor.setMaxPoolSize(6);
      executor.setQueueCapacity(50);
      executor.setThreadNamePrefix("decryption-worker-");
      executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
      executor.initialize();
      return executor;
  }
  ```

- Add JVM flags for production to allow predictable GC behavior and capture OOM data:
  - `-Xms512m -Xmx4g` (tune per environment)
  - `-XX:+UseG1GC` (or ZGC for very large heaps)
  - `-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/var/log/heapdumps`
  - `-Xlog:gc*:file=/var/log/gc.log:time,uptime,level,tags` (Java 11+ logging syntax)

- Add GC and heap monitoring via JMX + Prometheus JMX exporter, and alert thresholds for used heap percent (>75%).

Long-term / architectural
- Break huge microservice payloads into streaming APIs or chunked uploads rather than huge in-memory Strings.
- Consider moving very heavy work into a dedicated worker microservice with its own JVM tuned for batch processing, so the API backend remains lean.
- Use off-heap approaches (e.g., temporary files, disk-backed buffers) for very large intermediate payloads.
- Consider using an external durable job queue (e.g., Kafka, Redis queues, or RDBMS-backed job table) to process long-running jobs with retries and bounded concurrency.

Suggested code-level changes (examples)
- Detach persistence context after per-chunk save (if not already done):

  ```java
  @Autowired
  private EntityManager entityManager;

  // After saving per-chunk entities
  entityManager.flush();
  entityManager.clear();
  ```

- Replace repeated `System.gc()` usage: remove the calls and rely on JVM tuning. If you must keep them for diagnostics, wrap them behind a config flag and only enable in non-production diagnostic runs.

- Stream ballots instead of collecting into a list when feasible:

  ```java
  try (Stream<SubmittedBallot> s = submittedBallotRepository.streamByElectionCenterId(ecId)) {
    s.forEach(ballot -> {
      // process each ballot, avoid collecting all into memory
    });
  }
  ```

- Cache `candidateNames` and `partyNames` outside inner loops; only fetch once per process.

- Configure `@Async` task executor as above and tune pool sizes for your expected concurrency.

Monitoring and testing guidance
- Add Prometheus JMX exporter to collect `java.lang:type=Memory` and GC metrics.
- Add heap-dump-on-OOM and store dumps for offline analysis when OOM occurs.
- Run long-duration integration tests that emulate production load (number of election centers, ballots, and guardians) to find steady-state behavior.
- Use a profiler (YourKit, VisualVM, JFR recordings) to identify retained references.
- Test with container memory limits and ensure `-Xmx` is less than container limit.

Docker and deployment recommendations
- In `backend/Dockerfile` and `docker-compose.yml`, set JVM flags via `JAVA_OPTS` and limit container memory.
  - Example compose env: `JAVA_OPTS: -Xms512m -Xmx3g -XX:+UseG1GC -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/heapdumps -Xlog:gc*:file=/tmp/gc.log`
- Ensure host-level monitoring of memory and OOM kills.

Checklist for safe long-running async processes
- [ ] Per-chunk DB transactions that flush and clear the EntityManager.
- [ ] No unbounded in-memory accumulation (lists, cache, maps) across chunks.
- [ ] Bounded async executor for `@Async` tasks.
- [ ] JVM tuned with appropriate `-Xmx`/`-Xms`, GC, and OOM dump options.
- [ ] GC and heap metrics instrumented and exported to monitoring/alerting.
- [ ] Removal or gating of `System.gc()` behind config; not used for correctness.
- [ ] Stream large datasets instead of collecting into lists.
- [ ] Use disk-based buffering for extremely large payloads.

Actionable next steps I can implement for you
- Replace `System.gc()` calls with a configuration toggle and remove `Thread.sleep()` calls.
- Add `entityManager.flush()`/`entityManager.clear()` calls at per-chunk boundaries.
- Implement a Spring `ThreadPoolTaskExecutor` bean and ensure `@Async` uses it.
- Add sample `JAVA_OPTS` to `docker-compose.yml` and `backend/Dockerfile`.

If you want, I can open a PR implementing the short-term code changes (remove System.gc() calls or gate them, add entityManager.clear(), and add a bounded async executor). Tell me which items I should implement first.

---
Notes
- This guide is based on the observed `PartialDecryptionService` patterns. If other services follow similar patterns (large payloads, long loops), the same recommendations apply.
- Removing `System.gc()` and using proper JVM tuning + short transactions + streaming yields the most stable improvements.

import React, { useState } from "react";
import Layout from "./Layout";

const SvcBox = ({ icon, name, tech, ip, port, color }) => (
  <div className={`rounded-xl border-2 ${color} p-4 text-center bg-white shadow-md`}>
    <div className="text-2xl mb-1">{icon}</div>
    <div className="font-bold text-gray-900 text-sm">{name}</div>
    <div className="text-xs text-gray-500 mt-1 font-mono">{tech}</div>
    {ip && <div className="mt-1 text-xs font-mono text-blue-600">{ip}</div>}
    {port && <div className="text-xs font-mono text-gray-400">{port}</div>}
  </div>
);

const ArrowLabel = ({ label }) => (
  <div className="flex flex-col items-center my-1">
    <div className="w-px h-6 bg-gray-300" />
    <div className="text-xs text-gray-400 px-2 py-0.5 bg-gray-100 rounded font-mono border border-gray-200">{label}</div>
    <div className="w-px h-6 bg-gray-300" />
  </div>
);

const Architecture = () => {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <Layout>
      {/* ── Hero ─────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-300 text-sm font-medium mb-6">
            <span className="mr-2">🏗️</span>System Architecture
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
            AmarVote Infrastructure
          </h1>
          <p className="text-blue-200/80 text-lg max-w-2xl mx-auto">
            Six microservices orchestrated via Docker Compose with a private 172.20.0.0/24 overlay network, plus optional AI and observability layers.
          </p>
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-white sticky top-16 z-20">
        <div className="max-w-6xl mx-auto px-4 flex overflow-x-auto">
          {[
            ["overview", "🗺️ Overview"],
            ["services", "📦 Services"],
            ["network", "🌐 Network"],
            ["dataflow", "🔄 Data Flow"],
            ["rabbitmq", "🐰 RabbitMQ"],
            ["redis", "🔴 Redis"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">

        {/* ═══════════════════════ OVERVIEW ═══════════════════════ */}
        {activeTab === "overview" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">High-Level Architecture Diagram</h2>

            {/* System Map */}
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-8 mb-10 overflow-x-auto">
              <div className="min-w-[700px]">
                {/* Browser / User layer */}
                <div className="flex justify-center mb-4">
                  <div className="bg-white border-2 border-gray-300 rounded-xl px-8 py-3 font-semibold text-gray-700 shadow-sm">
                    🌐 Browser (User / Guardian / Admin)
                  </div>
                </div>
                <ArrowLabel label="HTTPS :443 (Nginx Proxy)" />

                {/* Frontend */}
                <div className="flex justify-center mb-2">
                  <SvcBox icon="⚛️" name="React Frontend" tech="React 19.1 · Vite 6 · Tailwind" ip="172.20.0.40" port="5173 dev / 80 prod" color="border-blue-400" />
                </div>
                <ArrowLabel label="HTTP REST + JSON" />

                {/* Backend */}
                <div className="flex justify-center mb-2">
                  <div className="w-80">
                    <SvcBox icon="☕" name="Spring Boot Backend" tech="Java 21 · Spring Boot 3.5.0" ip="172.20.0.30" port="8080" color="border-green-500" />
                  </div>
                </div>

                {/* Fan out */}
                <div className="flex justify-center gap-2 my-4">
                  <div className="flex flex-col items-end w-40">
                    <div className="w-px h-6 bg-gray-300 mx-auto" />
                    <div className="w-full h-px bg-gray-300" />
                  </div>
                  <div className="flex flex-col items-center w-40">
                    <div className="w-px h-6 bg-gray-300" />
                    <div className="w-full h-px bg-gray-300" />
                  </div>
                  <div className="flex flex-col items-start w-40">
                    <div className="w-px h-6 bg-gray-300 mx-auto" />
                    <div className="w-full h-px bg-gray-300" />
                  </div>
                </div>

                {/* Downstream row */}
                <div className="flex justify-center gap-4 mb-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-px h-6 bg-gray-300" />
                    <SvcBox icon="🗄️" name="PostgreSQL 15" tech="Alpine · Hibernate JPA" ip="172.20.0.20" port="5432" color="border-sky-400" />
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-px h-6 bg-gray-300" />
                    <SvcBox icon="🐰" name="RabbitMQ 3.13" tech="AMQP · Spring AMQP" ip="172.20.0.60" port="5672 / 15672 UI" color="border-orange-400" />
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-px h-6 bg-gray-300" />
                    <SvcBox icon="💾" name="Redis 7" tech="Alpine · Lettuce" ip="172.20.0.70" port="6379" color="border-red-400" />
                  </div>
                </div>

                {/* EG worker */}
                <div className="flex justify-center gap-4 mt-2">
                  <div className="flex flex-col items-center">
                    <ArrowLabel label="HTTP :5000 (fast API)" />
                    <SvcBox icon="🔐" name="EG Fast API" tech="Flask · ElectionGuard 2.x" ip="172.20.0.10" port="5000" color="border-purple-400" />
                  </div>
                  <div className="flex flex-col items-center">
                    <ArrowLabel label="RabbitMQ dequeue" />
                    <SvcBox icon="⚙️" name="EG Worker" tech="RabbitMQ consumer" ip="172.20.0.11" port="5001" color="border-violet-400" />
                  </div>
                </div>

                {/* Optional row */}
                <div className="flex justify-center gap-4 mt-6 opacity-70">
                  <SvcBox icon="🤖" name="RAG Service" tech="LangChain · ChromaDB · DeepSeek" ip="—" port="5001 alt (opt)" color="border-dashed border-teal-400" />
                  <SvcBox icon="📊" name="Prometheus / Grafana" tech="Micrometer scrape 15s" ip="—" port="9090 / 3000 (prod)" color="border-dashed border-gray-400" />
                </div>
                <p className="text-center text-xs text-gray-400 mt-2">Dashed services = optional (Docker Compose profiles)</p>
              </div>
            </div>

            {/* Nginx Proxy */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
              <h3 className="font-bold text-gray-900 text-lg mb-4">🔀 Nginx Reverse Proxy (Production)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600 text-sm mb-3">The nginx proxy terminates SSL and routes traffic to services based on path prefix:</p>
                  <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs text-gray-300">
                    <div className="text-green-400 mb-2"># nginx-proxy.conf routing rules</div>
                    <div><span className="text-yellow-300">location /api/</span> → Spring Boot :8080</div>
                    <div><span className="text-yellow-300">location /electionguard/</span> → EG API :5000</div>
                    <div><span className="text-yellow-300">location /rag/</span> → RAG service :5001</div>
                    <div><span className="text-yellow-300">location /</span> → React frontend :80</div>
                  </div>
                </div>
                <div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
                    <h4 className="font-semibold text-blue-800 mb-2">Production vs Development</h4>
                    <div className="space-y-2 text-gray-700">
                      <div><strong>Dev:</strong> <code className="bg-white px-1 rounded text-xs">docker-compose.yml</code> + Vite HMR on :5173</div>
                      <div><strong>Prod:</strong> <code className="bg-white px-1 rounded text-xs">docker-compose.prod.yml</code> + Nginx serving built React on :80, Prometheus + Grafana enabled</div>
                      <div><strong>DB Dev:</strong> Neon Cloud PostgreSQL (remote); Prod: local container :5432</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════ SERVICES ═══════════════════════ */}
        {activeTab === "services" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Service Deep Dives</h2>
            <div className="space-y-6">
              {[
                {
                  icon: "☕", name: "Spring Boot Backend", color: "green",
                  tech: "Java 21 · Spring Boot 3.5.0 · Maven · JPA/Hibernate · Spring Security · Spring AMQP",
                  ip: "172.20.0.30:8080",
                  desc: "Central orchestration service. Handles all business logic, authentication, election management, and RabbitMQ task publication.",
                  responsibilities: [
                    "OTP email authentication (6-digit, 5-min TTL) via Gmail SMTP (Spring Mail)",
                    "JWT session tokens (JJWT 0.12.6, 7-day, HttpOnly cookie, BCrypt strength=12)",
                    "Spring Security + CSRF protection, role-based access (VOTER / GUARDIAN / ADMIN)",
                    "Election CRUD, eligibility (open / restricted / listed / unlisted)",
                    "Cloudinary SDK 1.38.0: candidate/party/election image upload",
                    "Publishes decryption jobs to RabbitMQ with tally chunking (200 ballots/chunk, SecureRandom)",
                    "Resilience4j circuit breaker for ElectionGuard API calls",
                    "Prometheus metrics via Micrometer: JVM, HTTP, HikariCP, RabbitMQ queue depths",
                    "14-table PostgreSQL schema (Hibernate DDL auto-update), Neon Cloud dev / container prod",
                    "msgpack binary serialization via Jackson-msgpack (10–50× faster for 4096-bit integers)",
                    "API audit logging to DB with request/response body, status code, execution time",
                  ]
                },
                {
                  icon: "🔐", name: "ElectionGuard Microservice — Fast API Container", color: "purple",
                  tech: "Python 3.12 · Flask · Microsoft ElectionGuard SDK 2.x · gmpy2 · msgpack",
                  ip: "172.20.0.10:5000",
                  desc: "Handles time-sensitive synchronous operations: guardian key ceremony, ballot encryption, and session-scoped tasks that need low latency.",
                  responsibilities: [
                    "Guardian key ceremony: ElGamal keypair generation, Schnorr commitment proofs",
                    "Encrypt guardian private keys with ML-KEM-1024 + AES-256-CBC + Scrypt N=65536",
                    "Ballot encryption: ElGamal 4096-bit per candidate selection, ZK proofs, tracking code",
                    "Benaloh challenge nonce exposure (/challenge endpoint)",
                    "PKCS#7 ballot padding on all requests (fixed-size request bodies)",
                    "Fast path for single-ballot operations (P99 < 500ms)",
                    "msgpack deserialization of ballot objects from backend",
                  ]
                },
                {
                  icon: "⚙️", name: "ElectionGuard Microservice — Worker Container", color: "violet",
                  tech: "Python 3.12 · Flask · RabbitMQ consumer (aio-pika) · ElectionGuard SDK 2.x",
                  ip: "172.20.0.11:5001",
                  desc: "Long-running async batch processor for decryption phases. Consumes from RabbitMQ queues, coordinates via Redis, writes results to DB.",
                  responsibilities: [
                    "Tally creation: homomorphically multiply 200 encrypted ballots per chunk",
                    "Partial decryption: apply guardian's private key (fetched from Redis) to tally chunk",
                    "Compensated decryption: Lagrange interpolation on polynomial backups for absent guardians",
                    "Combines all partial/compensated shares → final vote totals + Chaum-Pedersen ZK proofs",
                    "Fetches guardian keys from Redis (6h TTL); coordinate completion via atomic INCR counters",
                    "Writes per-chunk results back to PostgreSQL tables",
                    "Handles retry logic: 3 attempts, exponential backoff (5s / 10s / 20s)",
                    "Memory management: entityManager.clear() + System.gc() after each chunk",
                  ]
                },
                {
                  icon: "🗄️", name: "PostgreSQL 15", color: "sky",
                  tech: "PostgreSQL 15 Alpine · Hibernate JPA · 14-table schema",
                  ip: "172.20.0.20:5432 (prod) / Neon Cloud (dev)",
                  desc: "Primary relational data store for all persistent state.",
                  responsibilities: [
                    "election: id, name, eligibility, status, guardian_quorum, candidate list, timestamps",
                    "guardian: election_id, public_key, polynomial_backup, decrypted_or_not flag",
                    "ballot: voter_id, election_id, encrypted_ballot (msgpack blob), tracking_code, cast_at",
                    "encrypted_tally: election_id, chunk_index, homomorphic product (msgpack blob)",
                    "partial_decryption + compensated_decryption: per-guardian, per-chunk share tables",
                    "election_result: final plaintext totals + Chaum-Pedersen proof JSON per candidate",
                    "election_job: task_id, phase, chunk_index, status, attempt_count, error_message",
                    "api_log: method, path, status, request_body, response_body, execution_ms",
                    "user, otp, voter_eligibility, election_image: auth + eligibility + media tables",
                  ]
                },
              ].map(({ icon, name, color, tech, ip, desc, responsibilities }) => (
                <div key={name} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center">
                      <span className="text-3xl mr-3">{icon}</span>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{name}</h3>
                        <div className="font-mono text-xs text-gray-500 mt-0.5">{tech}</div>
                      </div>
                    </div>
                    <div className="font-mono text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200 flex-shrink-0 ml-4">{ip}</div>
                  </div>
                  <p className="text-gray-600 text-sm mb-4">{desc}</p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {responsibilities.map((r) => (
                      <li key={r} className="flex items-start text-sm text-gray-700">
                        <span className="text-gray-400 mr-2 flex-shrink-0">→</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════ NETWORK ═══════════════════════ */}
        {activeTab === "network" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Docker Network Topology</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="font-bold text-gray-900 text-lg mb-4">Private Overlay Network</h3>
                <div className="bg-gray-900 rounded-xl p-5 font-mono text-xs text-gray-300 overflow-x-auto">
                  <div className="text-green-400 mb-3"># Docker network: amarvote_default</div>
                  <div className="text-yellow-300 mb-2">Subnet: 172.20.0.0/24</div>
                  <div className="text-blue-300 mb-4">Driver: bridge</div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-700">
                        <th className="text-left pb-1">Service</th>
                        <th className="text-left pb-1">IP Address</th>
                        <th className="text-left pb-1">Port(s)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["eg-api (fast)", "172.20.0.10", "5000"],
                        ["eg-worker", "172.20.0.11", "5001"],
                        ["postgres", "172.20.0.20", "5432"],
                        ["spring-backend", "172.20.0.30", "8080"],
                        ["react-frontend", "172.20.0.40", "5173/80"],
                        ["prometheus", "172.20.0.50", "9090"],
                        ["rabbitmq", "172.20.0.60", "5672, 15672"],
                        ["grafana", "172.20.0.60", "3000"],
                        ["redis", "172.20.0.70", "6379"],
                        ["redis-replica", "172.20.0.75", "6379"],
                      ].map(([svc, ip, port]) => (
                        <tr key={svc} className="border-b border-gray-800">
                          <td className="py-1.5 text-blue-300">{svc}</td>
                          <td className="py-1.5 text-yellow-300">{ip}</td>
                          <td className="py-1.5 text-gray-400">{port}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h3 className="font-bold text-gray-900 mb-3">Communication Protocols</h3>
                  <div className="space-y-3 text-sm">
                    {[
                      ["Browser → Frontend", "HTTPS via Nginx reverse proxy"],
                      ["Frontend → Backend", "HTTP REST JSON (Axios), /api/* prefix"],
                      ["Backend → EG Fast API", "HTTP REST msgpack (binary), Resilience4j circuit breaker"],
                      ["Backend → RabbitMQ", "AMQP 0.9.1 via Spring AMQP (Jackson-msgpack serialized)"],
                      ["EG Worker → RabbitMQ", "AMQP consumer (aio-pika), prefetch=1"],
                      ["Backend → Redis", "Lettuce (async), GET/SET/INCR/SET NX/EXPIRE"],
                      ["EG Worker → Redis", "redis-py, GET private key, INCR phase counter"],
                      ["All services → Postgres", "JDBC (backend), psycopg2 (EG worker)"],
                      ["Prometheus → Backend", "HTTP scrape /actuator/prometheus every 15s"],
                    ].map(([from, proto]) => (
                      <div key={from} className="flex items-start">
                        <span className="text-blue-500 mr-2 flex-shrink-0">→</span>
                        <div><strong className="text-gray-800">{from}:</strong> <span className="text-gray-600">{proto}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm">
                  <h4 className="font-bold text-amber-800 mb-2">⚠️ Optional Profile Services</h4>
                  <p className="text-amber-700">RAG service and Prometheus/Grafana are enabled via Docker Compose profile overrides. Core 6-service platform runs without them.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════ DATA FLOW ═══════════════════════ */}
        {activeTab === "dataflow" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Election Data Flow</h2>
            <div className="space-y-8">
              {[
                {
                  phase: "Phase 1 — Election Setup & Key Ceremony",
                  color: "blue",
                  steps: [
                    ["Admin", "Creates election via React form (name, description, candidates, quorum k-of-n)"],
                    ["Spring Boot", "Calls EG Fast API /ceremony/setup → generates guardian ElGamal keypairs + Schnorr commitment proofs"],
                    ["EG Fast API", "Returns public keys; Backend saves guardian records to PostgreSQL"],
                    ["Spring Boot", "Encrypts each guardian's private key: ML-KEM-1024 KEM → AES-256-CBC wrap → Scrypt KDF → HMAC-SHA256 tag"],
                    ["Gmail SMTP", "Emails each guardian their encrypted credential file (.json) with their share"],
                  ]
                },
                {
                  phase: "Phase 2 — Voter Authentication & Ballot Casting",
                  color: "green",
                  steps: [
                    ["Voter", "Enters email → Backend sends 6-digit OTP (5-min TTL) via Gmail SMTP"],
                    ["Spring Boot", "Validates OTP, issues JWT (JJWT, 7-day, HttpOnly cookie, BCrypt strength=12)"],
                    ["React Frontend", "FingerprintJS BotD 1.9.1 check before ballot page loads"],
                    ["React Frontend", "Calls EG Fast API /ballot/encrypt → returns ciphertext + tracking code + ZK proof"],
                    ["Voter (optional)", "Benaloh challenge: request nonce reveal → verify encryption was honest → spoil → re-vote"],
                    ["React Frontend", "PKCS#7-pads ballot POST request → Backend validates bot flag + 5-min timestamp"],
                    ["Spring Boot", "Saves encrypted ballot (msgpack blob) to ballot table with tracking_code"],
                  ]
                },
                {
                  phase: "Phase 3 — Tally & RabbitMQ Processing",
                  color: "orange",
                  steps: [
                    ["Admin", "Clicks 'Initiate Tally' → Backend fetches all cast ballot ciphertexts"],
                    ["Spring Boot", "SecureRandom shuffles ballots, splits into 200-ballot chunks"],
                    ["Spring Boot", "Creates election_job records per chunk; publishes to tally.creation.queue via RabbitMQ exchange"],
                    ["RoundRobinScheduler", "100ms tick — dequeues PENDING chunks round-robin across all active elections, publishes to AMQP"],
                    ["EG Worker", "4 concurrent consumers with prefetch=1 each; processes one chunk at a time"],
                    ["EG Worker", "For each tally chunk: homomorphically multiplies 200 encrypted ballots into 1 encrypted tally chunk"],
                    ["Redis", "INCR tally_complete_count_${electionId}; SET NX triggers phase transition exactly once"],
                    ["Spring Boot", "When all tally chunks complete: publishes partial.decryption.queue messages for each guardian×chunk combo"],
                  ]
                },
                {
                  phase: "Phase 4 — Guardian Decryption",
                  color: "purple",
                  steps: [
                    ["Guardian", "Uploads credential file via React frontend → Backend decrypts ML-KEM-1024 wrap"],
                    ["Spring Boot", "Stores decrypted ElGamal private key in Redis: key guardian:${id}:key, TTL=6h"],
                    ["EG Worker", "Reads key from Redis per partial decryption chunk; applies guardian private key → partial share"],
                    ["EG Worker", "For absent guardians: uses present guardians' polynomial backups + Lagrange interpolation → compensated share"],
                    ["Redis", "INCR partial_complete_count per election; when all done → SET NX triggers combine phase"],
                    ["Spring Boot", "Publishes to combine.decryption.queue once all shares (partial + compensated) complete"],
                    ["EG Worker", "Assembles all shares → final vote totals + Chaum-Pedersen proofs → saves to election_result table"],
                    ["Spring Boot", "Updates election status = DECRYPTED; frontend polls and displays animated results"],
                  ]
                },
              ].map(({ phase, color, steps }) => (
                <div key={phase} className={`bg-white rounded-2xl border-l-4 ${color === "blue" ? "border-blue-500" : color === "green" ? "border-green-500" : color === "orange" ? "border-orange-500" : "border-purple-500"} border-r border-t border-b border-gray-200 p-6 shadow-sm`}>
                  <h3 className={`text-xl font-bold mb-5 ${color === "blue" ? "text-blue-800" : color === "green" ? "text-green-800" : color === "orange" ? "text-orange-800" : "text-purple-800"}`}>{phase}</h3>
                  <div className="space-y-3">
                    {steps.map(([actor, action], i) => (
                      <div key={i} className="flex items-start">
                        <div className="flex items-center flex-shrink-0 mr-3">
                          <div className={`w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center ${color === "blue" ? "bg-blue-500" : color === "green" ? "bg-green-500" : color === "orange" ? "bg-orange-500" : "bg-purple-500"}`}>{i + 1}</div>
                        </div>
                        <div>
                          <span className={`font-semibold text-sm ${color === "blue" ? "text-blue-700" : color === "green" ? "text-green-700" : color === "orange" ? "text-orange-700" : "text-purple-700"}`}>[{actor}]</span>
                          <span className="text-gray-700 text-sm ml-2">{action}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════ RABBITMQ ═══════════════════════ */}
        {activeTab === "rabbitmq" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">RabbitMQ Architecture Deep Dive</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="font-bold text-gray-900 mb-4">4 Processing Queues</h3>
                <div className="space-y-4">
                  {[
                    { q: "tally.creation.queue", rk: "task.tally.creation", workers: 4, desc: "Homomorphically multiplies 200 encrypted ballots → 1 encrypted tally chunk per message" },
                    { q: "partial.decryption.queue", rk: "task.partial.decryption", workers: 4, desc: "Applies one guardian's private key (from Redis) to one tally chunk → partial decryption share" },
                    { q: "compensated.decryption.queue", rk: "task.compensated.decryption", workers: 4, desc: "Present guardians reconstruct absent guardians' shares via Lagrange interpolation on polynomial backups" },
                    { q: "combine.decryption.queue", rk: "task.combine.decryption", workers: 4, desc: "Assembles all partial + compensated shares → final vote counts + Chaum-Pedersen ZK proofs" },
                  ].map(({ q, rk, workers, desc }) => (
                    <div key={q} className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <div className="font-mono text-orange-800 font-bold text-sm">{q}</div>
                      <div className="font-mono text-gray-500 text-xs mb-2">routing key: {rk} · {workers} consumers · prefetch=1</div>
                      <p className="text-gray-700 text-sm">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="bg-gray-900 rounded-2xl p-5 text-xs font-mono text-gray-300 mb-4">
                  <div className="text-green-400 font-bold mb-3 text-sm">RoundRobinTaskScheduler</div>
                  <pre className="whitespace-pre-wrap leading-relaxed overflow-x-auto">{`// Spring @Scheduled(fixedRate = 100ms)
// targetChunksPerCycle = 8
// maxQueuedChunks = 1

For each 100ms tick:
  Load all ACTIVE tally tasks (ordered by taskIndex)
  Process round-robin:
    For task T at index i:
      queuedCount = count chunks in QUEUED state
      If queuedCount < MAX_QUEUED (1):
        pendingChunk = pop next PENDING chunk
        Mark chunk → QUEUED in DB
        Publish to RabbitMQ topic exchange
        chunksPublished++
      If chunksPublished >= 8: break

// This ensures:
// Election A (500 chunks) does NOT starve Election B (50 chunks)
// Fair interleaving at the 100ms scheduling granularity`}</pre>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h4 className="font-bold text-gray-900 mb-3">Task ID Format</h4>
                  <div className="space-y-2 font-mono text-xs text-gray-600 bg-gray-50 rounded-lg p-3">
                    <div><span className="text-blue-600">TALLY_e42_1704067200000</span></div>
                    <div><span className="text-purple-600">PARTIAL_DECRYPT_e42_g3_1704067200000</span></div>
                    <div><span className="text-orange-600">COMPENSATED_DECRYPT_e42_g3_g1_1704067200000</span></div>
                    <div><span className="text-green-600">COMBINE_e42_1704067200000</span></div>
                    <div className="text-gray-400 mt-2 font-sans">Format: PHASE_electionId_guardianId?_timestamp</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4">Fault Tolerance & Configuration</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  ["Durable Queues", "Messages survive RabbitMQ restarts"],
                  ["defaultRequeueRejected=false", "Failed messages go to DLX, not re-queued infinitely"],
                  ["Retry Policy", "3 attempts with exponential backoff: 5s → 10s → 20s"],
                  ["PERMANENTLY_FAILED", "Final state after 3 failures; admin can inspect and retry"],
                  ["concurrentConsumers", "min=4, max=4 per queue (Spring AMQP SimpleMessageListenerContainer)"],
                  ["Memory management", "entityManager.clear() + System.gc() per chunk to avoid OOM"],
                  ["Redis lock", "SET NX key ex 300 prevents concurrent processing of same chunk"],
                  ["ConcurrentHashMap", "In-memory set of in-flight task IDs per JVM instance"],
                  ["AMQP exchange", "Topic exchange: all queues bound with their routing key pattern"],
                ].map(([k, v]) => (
                  <div key={k} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                    <div className="font-mono text-orange-700 text-xs font-bold mb-1">{k}</div>
                    <div className="text-gray-600 text-xs">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════ REDIS ═══════════════════════ */}
        {activeTab === "redis" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Redis Usage Deep Dive</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {[
                {
                  icon: "🔑", title: "Guardian Private Key Cache",
                  color: "bg-purple-50 border-purple-200",
                  ttl: "6 hours",
                  pattern: "guardian:{guardianId}:key",
                  type: "STRING (binary, msgpack)",
                  commands: ["SET guardian:42:key <blob> EX 21600", "GET guardian:42:key"],
                  desc: "When a guardian submits their credential file, the backend decrypts the ML-KEM-1024 wrapper and stores the raw ElGamal private key in Redis. EG workers read this key for each partial decryption chunk without hitting the database.",
                  notes: ["Key expires after 6h. Guardian must re-submit if decryption takes longer.", "Value is msgpack-encoded 4096-bit integer (far smaller than JSON string representation)"],
                },
                {
                  icon: "🔢", title: "Phase Completion Counters",
                  color: "bg-red-50 border-red-200",
                  ttl: "No expiry (deleted after use)",
                  pattern: "tally_complete:{electionId}, partial_complete:{electionId}, etc.",
                  type: "Counter (INCR)",
                  commands: ["INCR tally_complete:42", "GET tally_complete:42", "DEL tally_complete:42"],
                  desc: "Each EG worker increments a counter after completing a chunk. When count == total_chunks, a single worker wins the SET NX race and publishes the next-phase jobs. This is self-coordinating — no central coordinator needed.",
                  notes: ["Atomic INCR is crash-safe: no lost increments", "SET NX (set if not exists) ensures exactly-once phase transition"],
                },
                {
                  icon: "🔒", title: "Distributed Processing Locks",
                  color: "bg-orange-50 border-orange-200",
                  ttl: "300 seconds",
                  pattern: "lock:chunk:{chunkId}",
                  type: "SET NX with EX",
                  commands: ["SET lock:chunk:c99 1 NX EX 300", "DEL lock:chunk:c99"],
                  desc: "Before processing a chunk, a worker acquires a Redis lock. If another worker (e.g. after a restart or duplicate delivery) tries to process the same chunk, SET NX returns 0 and the worker skips it. Combined with ConcurrentHashMap in JVM.",
                  notes: ["300s TTL ensures lock is always released even if worker crashes", "DEL releases lock immediately upon successful completion"],
                },
              ].map(({ icon, title, color, ttl, pattern, type, commands, desc, notes }) => (
                <div key={title} className={`rounded-2xl border p-5 ${color}`}>
                  <div className="text-2xl mb-2">{icon}</div>
                  <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
                  <div className="text-xs font-mono text-gray-500 mb-3">TTL: {ttl}</div>
                  <div className="bg-gray-900 rounded-lg p-3 mb-3">
                    <div className="text-xs text-gray-500 mb-1">Patterns</div>
                    <div className="font-mono text-yellow-300 text-xs">{pattern}</div>
                    <div className="font-mono text-gray-400 text-xs mt-1">Type: {type}</div>
                  </div>
                  <div className="bg-black rounded-lg p-2 mb-3 font-mono text-xs text-green-400">
                    {commands.map((c) => <div key={c}>{c}</div>)}
                  </div>
                  <p className="text-gray-700 text-xs mb-2">{desc}</p>
                  <ul className="space-y-1">
                    {notes.map((n) => <li key={n} className="text-xs text-gray-500 flex items-start"><span className="mr-1">•</span>{n}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4">Redis Infrastructure</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Primary Instance</h4>
                  <div className="space-y-1 text-gray-600">
                    <div><strong>Image:</strong> redis:7-alpine</div>
                    <div><strong>Host:</strong> 172.20.0.70:6379</div>
                    <div><strong>Config:</strong> Custom rabbitmq.conf (maxmemory, eviction policy)</div>
                    <div><strong>Client (Java):</strong> Lettuce (async, non-blocking)</div>
                    <div><strong>Client (Python):</strong> redis-py (synchronous)</div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Replica Instance (optional)</h4>
                  <div className="space-y-1 text-gray-600">
                    <div><strong>Host:</strong> 172.20.0.75:6379</div>
                    <div><strong>Role:</strong> Read replica for key-cache reads under high guardian concurrency</div>
                    <div><strong>Sync:</strong> Redis native replication (REPLICAOF)</div>
                    <div><strong>Note:</strong> Write operations always go to primary</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
};

export default Architecture;

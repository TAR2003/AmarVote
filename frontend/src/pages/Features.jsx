import React, { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "./Layout";

const FeatureCard = ({ icon, title, items, color }) => {
  const colors = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    purple: "bg-purple-50 border-purple-200",
    orange: "bg-orange-50 border-orange-200",
    red: "bg-red-50 border-red-200",
    indigo: "bg-indigo-50 border-indigo-200",
    teal: "bg-teal-50 border-teal-200",
    amber: "bg-amber-50 border-amber-200",
  };
  const headColors = {
    blue: "text-blue-800", green: "text-green-800", purple: "text-purple-800",
    orange: "text-orange-800", red: "text-red-800", indigo: "text-indigo-800",
    teal: "text-teal-800", amber: "text-amber-800",
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[color]}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className={`font-bold text-lg mb-3 ${headColors[color]}`}>{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start text-sm text-gray-700">
            <span className="mr-2 text-gray-400 flex-shrink-0">•</span>{item}
          </li>
        ))}
      </ul>
    </div>
  );
};

function Features() {
  const [activeTab, setActiveTab] = useState("crypto");

  return (
    <Layout>
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-900 to-indigo-900 py-16 px-4 text-center">
        <div className="inline-flex items-center px-4 py-2 bg-blue-500/10 border border-blue-400/30 rounded-full text-blue-300 text-sm font-medium mb-6">
          <span className="mr-2">⚡</span>All Platform Features
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">Every Feature, Every Detail</h1>
        <p className="text-blue-200/80 text-lg max-w-2xl mx-auto">
          A complete breakdown of AmarVote's cryptographic, architectural, security, and UX capabilities.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white sticky top-16 z-20">
        <div className="max-w-6xl mx-auto px-4 flex overflow-x-auto">
          {[
            ["crypto", "🔐 Cryptography"],
            ["arch", "🏗️ Architecture"],
            ["security", "🛡️ Security Layers"],
            ["election", "🗳️ Election Management"],
            ["monitoring", "📊 Monitoring"],
            ["optional", "⚡ Optional Services"],
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

        {/* Cryptography tab */}
        {activeTab === "crypto" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">Cryptographic Features</h2>
            <p className="text-gray-500 text-center mb-8">Every layer is cryptographically sound and independently verifiable</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
              <FeatureCard icon="🔒" color="purple" title="ElGamal 4096-bit End-to-End Encryption (ElectionGuard)"
                items={[
                  "Each ballot selection encrypted with 4096-bit ElGamal (NIST safe-prime group)",
                  "Encryption produces (α, β) ciphertext pair + nonce ξ per selection",
                  "4096-bit provides ~200 bits classical security — far beyond NIST 2030 recommendations",
                  "gmpy2 (GMP) library for hardware-accelerated bignum arithmetic",
                  "Follows Microsoft ElectionGuard Specification 2.1 precisely",
                  "Public key K = product of all guardian public key shares K_i",
                ]} />
              <FeatureCard icon="🧮" color="blue" title="Homomorphic Tallying"
                items={[
                  "Encrypted ballots multiplied together: A=∏α_i, B=∏β_i mod p",
                  "Result is an encrypted count — never individual decryption needed",
                  "Tallying happens in chunked batches of 200 ballots via RabbitMQ",
                  "SecureRandom ballot shuffle before chunking prevents ordering bias",
                  "Supports elections with 10,000+ voters without OutOfMemoryError",
                  "Final encrypted tally stored per-chunk then combined",
                ]} />
              <FeatureCard icon="🔑" color="orange" title="Threshold Decryption (k-of-n)"
                items={[
                  "Admin sets quorum k and total guardian count n at election creation",
                  "Each guardian holds a polynomial secret share (degree k-1 polynomial)",
                  "Decryption requires exactly k guardians — no single point of failure",
                  "Absent guardians: present guardians compute compensated partial shares via Lagrange interpolation",
                  "Compensator uses absent guardian's polynomial backup coefficient",
                  "Final tally = ∏M_i^(λ_i) where λ_i are Lagrange coefficients mod q",
                ]} />
              <FeatureCard icon="🛡️" color="indigo" title="Post-Quantum Key Protection (ML-KEM-1024)"
                items={[
                  "Guardian ElGamal private keys wrapped with ML-KEM-1024 (CRYSTALS-Kyber)",
                  "NIST FIPS 203 standardized — Category 5 (256-bit post-quantum security)",
                  "Combined with AES-256-CBC and Scrypt (N=2^16, r=8) for layered protection",
                  "HMAC-SHA256 authenticates the entire credential file",
                  "Credential delivered to guardian via email as .json file",
                  "Resistant to Shor's algorithm on quantum computers",
                ]} />
              <FeatureCard icon="✅" color="teal" title="Zero-Knowledge Proofs"
                items={[
                  "Schnorr σ-protocol: every ballot proves selection ∈ {0,1} (no overvoting)",
                  "Chaum-Pedersen proof: every partial decryption proves correct key was used",
                  "All proofs are non-interactive via Fiat-Shamir heuristic",
                  "Proofs downloadable for independent third-party verification",
                  "Verifier can recompute: g^v·K^c == a AND A^v·M^c == b",
                  "No trusted setup required — transparent public parameters",
                ]} />
              <FeatureCard icon="🔍" color="green" title="Benaloh Challenge (Cast-or-Spoil)"
                items={[
                  "After ballot encryption, voter may challenge before casting",
                  "Challenge: system reveals encryption nonce ξ; voter verifies α=g^ξ, β=g^m·K^ξ",
                  "Challenged ballot is spoiled (publicly logged with nonce), not counted",
                  "Spoiled voter must re-encrypt and re-cast (ballot secrecy maintained)",
                  "Repeated challenging makes software fraud exponentially detectable",
                  "Public spoiled ballot audit trail proves honest encryption during election",
                ]} />
            </div>
            <div className="bg-gray-900 rounded-2xl p-6 overflow-x-auto">
              <h3 className="text-green-400 font-bold font-mono mb-4">// Full Cryptographic Specification</h3>
              <table className="w-full font-mono text-xs text-gray-300">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left pb-2">Algorithm</th>
                    <th className="text-left pb-2">Key Size / Params</th>
                    <th className="text-left pb-2">Standard</th>
                    <th className="text-left pb-2">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["ElGamal", "4096-bit prime", "ElectionGuard 2.1", "Vote encryption"],
                    ["ML-KEM-1024 (Kyber)", "1024 (Cat 5)", "NIST FIPS 203", "Post-quantum KEM"],
                    ["AES-CBC", "256-bit key", "NIST FIPS 197", "Symmetric wrap"],
                    ["Scrypt", "N=65536, r=8, p=1", "RFC 7914", "KDF for guardian creds"],
                    ["HMAC-SHA256", "256-bit", "FIPS 198-1", "Credential auth tag"],
                    ["SHA-256", "256-bit", "FIPS 180-4", "Tracking code / ballot hash"],
                    ["BCrypt", "strength=12", "—", "User password hash"],
                    ["JJWT HMAC-SHA256", "256-bit", "RFC 7519", "JWT session tokens"],
                    ["Chaum-Pedersen", "σ-protocol", "ElectionGuard 2.1", "Decryption ZK proof"],
                    ["Schnorr OR-proof", "σ-protocol", "ElectionGuard 2.1", "Ballot validity ZK proof"],
                    ["msgpack", "binary encoding", "MessagePack spec", "10–50× compact vs JSON"],
                    ["ECDSA / keccak256", "secp256k1", "Ethereum Yellow Paper", "Blockchain anchoring (opt)"],
                  ].map(([algo, key, std, purpose]) => (
                    <tr key={algo} className="border-b border-gray-800">
                      <td className="py-1.5 pr-4 text-blue-300 font-bold">{algo}</td>
                      <td className="py-1.5 pr-4 text-yellow-300">{key}</td>
                      <td className="py-1.5 pr-4 text-gray-400">{std}</td>
                      <td className="py-1.5 text-gray-300">{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Architecture tab */}
        {activeTab === "arch" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">Platform Architecture</h2>
            <p className="text-gray-500 text-center mb-8">Six microservices on a private Docker overlay network, purpose-built for a voting workload</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FeatureCard icon="⚛️" color="blue" title="React 19.1 Frontend (172.20.0.40)"
                items={[
                  "Vite 6.3.5 build tool with HMR in dev, optimized bundle in prod",
                  "Tailwind CSS 3.4.17 + Framer Motion 12.23.26 for animations",
                  "Recharts 2.8.0 for animated election result charts",
                  "jsPDF + autotable 2.5.1/3.6.0: admin PDF report exports",
                  "Axios 1.9.0 with JWT cookie interceptors",
                  "FingerprintJS BotD 1.9.1: browser bot detection before ballot cast",
                  "Vitest 3.2.4 unit testing framework",
                ]} />
              <FeatureCard icon="☕" color="green" title="Spring Boot 3.5.0 Backend (172.20.0.30:8080)"
                items={[
                  "Java 21 with virtual threads (Spring WebMVC, not reactive)",
                  "Spring Security 6.x: JWT filter chain, role-based endpoints, CSRF",
                  "Spring Data JPA + Hibernate DDL auto-update (14-table schema)",
                  "Spring AMQP: 4 listener containers (prefetch=1, 4 consumers each)",
                  "Spring Data Redis (Lettuce): async guardian key cache + INCR + SET NX",
                  "Resilience4j circuit breaker for EG API calls",
                  "Micrometer + Prometheus: /actuator/prometheus scrape endpoint",
                  "Jackson-dataformat-msgpack 0.9.8 for binary ballot serialization",
                ]} />
              <FeatureCard icon="🔐" color="purple" title="ElectionGuard Microservice — Two Containers"
                items={[
                  "Fast API (172.20.0.10:5000): synchronous key ceremony + ballot encryption",
                  "Worker (172.20.0.11:5001): async tally + partial + compensated + combine",
                  "Python 3.12 + Flask + Microsoft ElectionGuard SDK 2.x",
                  "gmpy2: GMP-accelerated 4096-bit arithmetic",
                  "aio-pika: asyncio RabbitMQ consumer in worker container",
                  "Split design: fast API has sub-500ms P99; worker handles 10k+ ballot elections",
                  "Redis client (redis-py): fetches guardian keys + INCR phase counters",
                ]} />
              <FeatureCard icon="🐰" color="orange" title="RabbitMQ 3.13 (172.20.0.60:5672)"
                items={[
                  "4 durable queues: tally.creation, partial.decryption, compensated.decryption, combine.decryption",
                  "Topic exchange with per-queue routing keys",
                  "RoundRobinTaskScheduler: 100ms tick, fair interleaving across concurrent elections",
                  "prefetch=1 per consumer: no single worker gets backlogged",
                  "defaultRequeueRejected=false: failed messages to DLX",
                  "3 retry attempts (5s/10s/20s exponential backoff) → PERMANENTLY_FAILED",
                  "Management UI at :15672 for queue monitoring",
                ]} />
              <FeatureCard icon="💾" color="red" title="Redis 7 Alpine (172.20.0.70:6379)"
                items={[
                  "Guardian private key cache: STRING type, 6h TTL, binary msgpack value",
                  "Phase completion counters: atomic INCR, self-coordinating worker phases",
                  "Distributed chunk locks: SET NX with 300s EX, prevents double-processing",
                  "Optional replica at 172.20.0.75:6379 for key-read throughput",
                  "Lettuce (Java async) + redis-py (Python sync) client drivers",
                  "Custom rabbitmq.conf: maxmemory-policy = allkeys-lru",
                ]} />
              <FeatureCard icon="🗄️" color="teal" title="PostgreSQL 15 Alpine (172.20.0.20:5432)"
                items={[
                  "14 tables: election, guardian, ballot, encrypted_tally, partial_decryption, compensated_decryption, election_result, election_job, api_log, user, otp, voter_eligibility, election_image, sponsor",
                  "Hibernate DDL auto-update (dev) / validate (prod)",
                  "Neon Cloud serverless PostgreSQL in development",
                  "HikariCP connection pool with Micrometer metrics",
                  "Audit log table: every API call logged with request/response/timing",
                ]} />
            </div>
          </div>
        )}

        {/* Security layers tab */}
        {activeTab === "security" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">Security Layers</h2>
            <p className="text-gray-500 text-center mb-8">Defense-in-depth from the browser to the database</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FeatureCard icon="🪪" color="blue" title="Authentication (Passwordless OTP)"
                items={[
                  "6-digit OTP generated with Java SecureRandom (cryptographically random)",
                  "5-minute TTL stored in DB; single-use (invalidated immediately on validation)",
                  "Delivered via Gmail SMTP (Spring Mail) with TLS",
                  "JWT session: HMAC-SHA256, 7-day, HttpOnly cookie (XSS-safe)",
                  "Spring Security CSRF protection + SameSite cookie attribute",
                  "No passwords ever stored — eliminates credential stuffing entirely",
                ]} />
              <FeatureCard icon="🤖" color="red" title="Bot Detection & Replay Prevention"
                items={[
                  "FingerprintJS BotD 1.9.1: JavaScript bot detection score + isBot flag",
                  "Bot flag and submission timestamp included in ballot POST request",
                  "Server validates isBot == false; rejects with HTTP 403 if true",
                  "Timestamp freshness check: |server_time - client_timestamp| > 5 minutes → reject",
                  "Prevents automated ballot stuffing and replay attacks",
                  "Works even when JS bot detection is bypassed: timestamp check is server-side",
                ]} />
              <FeatureCard icon="📦" color="indigo" title="Traffic Analysis Prevention (PKCS#7)"
                items={[
                  "All ballot submission requests padded to a fixed size with PKCS#7",
                  "Prevents adversary from inferring popular candidates by monitoring payload sizes",
                  "Fixed-size requests: no correlation between request size and voter choice",
                  "Applied at the ballot encryption layer before submission",
                  "Standard: RFC 5652 (Cryptographic Message Syntax)",
                ]} />
              <FeatureCard icon="🔗" color="purple" title="API Security"
                items={[
                  "All endpoints protected by Spring Security role-based access control",
                  "JWT bearer token in HttpOnly cookie — not readable by JavaScript",
                  "CSRF double-submit cookie pattern via Spring Security",
                  "Resilience4j circuit breaker on ElectionGuard API calls",
                  "Every request/response logged to api_log table (audit trail)",
                  "Election eligibility enforced server-side: open / restricted / listed / unlisted modes",
                ]} />
              <FeatureCard icon="🌐" color="teal" title="Network Security"
                items={[
                  "Services communicate on private 172.20.0.0/24 Docker overlay network",
                  "No service ports exposed to public except Nginx reverse proxy",
                  "Nginx terminates TLS in production; internal HTTP on private network",
                  "RabbitMQ and Redis network-isolated (no external exposure)",
                  "PostgreSQL accessible only from Spring Boot backend container",
                ]} />
              <FeatureCard icon="🔐" color="green" title="Credential Security (Guardian Keys)"
                items={[
                  "Guardian private keys encrypted with ML-KEM-1024 + AES-256-CBC + Scrypt",
                  "Scrypt N=65536: ~65ms compute time makes brute-force expensive",
                  "HMAC-SHA256 tag on credential file detects any tampering",
                  "After decryption: key stored in Redis with 6h TTL (not in DB)",
                  "Redis key automatically expires — no long-term plaintext key persistence",
                  "Multiple layers resist both classical and quantum attacks",
                ]} />
            </div>
          </div>
        )}

        {/* Election Management tab */}
        {activeTab === "election" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">Election Management Features</h2>
            <p className="text-gray-500 text-center mb-8">Complete lifecycle from creation to verified results</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FeatureCard icon="📋" color="blue" title="Election Creation"
                items={[
                  "Admin creates election: name, description, start/end dates, candidates",
                  "Configure guardian count (n) and quorum threshold (k)",
                  "Eligibility modes: open (any user), restricted (verified users), listed (by email), unlisted (private link)",
                  "Upload candidate/party/election images via Cloudinary SDK 1.38.0",
                  "ElectionGuard key ceremony: backend calls EG Fast API to generate guardian keypairs",
                  "Guardian credentials emailed automatically after ceremony",
                ]} />
              <FeatureCard icon="🗳️" color="green" title="Ballot Casting"
                items={[
                  "Voter selects candidate(s) in React UI",
                  "Frontend calls EG Fast API to encrypt — receives ciphertext + tracking code",
                  "Optional Benaloh challenge before final submission",
                  "FingerprintJS bot detection + timestamp included in cast request",
                  "PKCS#7 padding on all ballot POST requests",
                  "Tracking code saved: voter can verify inclusion post-election",
                  "One ballot per voter per election enforced at DB level",
                ]} />
              <FeatureCard icon="📊" color="purple" title="Tally & Decryption Workflow"
                items={[
                  "Admin initiates tally → backend chunks 200 ballots each (SecureRandom shuffle)",
                  "Each chunk published to tally.creation.queue via RabbitMQ",
                  "Workers homomorphically multiply ciphertexts → encrypted tally chunks",
                  "Admin prompts guardians → they submit credentials → keys in Redis",
                  "Workers consume partial.decryption.queue: one partial share per guardian per chunk",
                  "Absent guardian compensation via Lagrange interpolation",
                  "Combine phase assembles all shares → final vote totals + ZK proofs",
                  "Election status → DECRYPTED; animated results shown to voters",
                ]} />
              <FeatureCard icon="🎨" color="orange" title="Results & UI"
                items={[
                  "Animated bar/pie charts using Recharts 2.8.0",
                  "Real-time decryption progress bar (polls backend % complete)",
                  "Per-candidate vote counts + percentage shares",
                  "PDF export of results via jsPDF",
                  "All results accompanied by downloadable Chaum-Pedersen proof JSON",
                  "Framer Motion animations for result reveal (smooth, professional)",
                ]} />
              <FeatureCard icon="👥" color="teal" title="Role Dashboards"
                items={[
                  "Voter: browse elections, cast ballot, view tracking code, check results",
                  "Guardian: credential submission UI, decryption status tracker",
                  "Admin: election CRUD, tally initiation, combine trigger, API log viewer",
                  "All dashboards are role-gated (Spring Security) — wrong role = 403",
                  "Responsive layouts for mobile, tablet, desktop",
                  "Real-time status indicators for active elections",
                ]} />
              <FeatureCard icon="📝" color="amber" title="Audit & Transparency"
                items={[
                  "Every API call logged: method, path, status, request body, response body, timing, user",
                  "Admin API log page: paginated table with search",
                  "Election audit trail: all ballots, all chunks, all partial shares in DB",
                  "Guardian decrypted_or_not flag: transparency over who participated",
                  "Public tracking code lookup for ballot inclusion verification",
                  "Optional blockchain anchoring: SHA-256 ballot hash on Ethereum-compatible chain",
                ]} />
            </div>
          </div>
        )}

        {/* Monitoring tab */}
        {activeTab === "monitoring" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">Observability & Monitoring</h2>
            <p className="text-gray-500 text-center mb-8">Production-grade Prometheus metrics, pre-configured Grafana dashboards</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <FeatureCard icon="📈" color="blue" title="Prometheus Metrics (Spring Boot Actuator)"
                items={[
                  "Micrometer integration: auto-instruments Spring MVC, JVM, HikariCP",
                  "/actuator/prometheus endpoint scraped every 15s",
                  "JVM metrics: heap usage, GC pauses, thread count, class loading",
                  "HTTP metrics: request rates, P50/P95/P99 latencies by endpoint",
                  "HikariCP pool metrics: active connections, pending threads, connection wait time",
                  "RabbitMQ metrics: queue depths, consumer counts, publish rates",
                  "Custom metrics: decryption chunk progress, guardian key cache hits",
                ]} />
              <FeatureCard icon="📉" color="green" title="Grafana Dashboards (Production)"
                items={[
                  "Dashboard ID 4701: JVM (Micrometer) — heap, GC, threads, classes",
                  "Dashboard ID 6756: Spring Boot Statistics — HTTP rates, error rates",
                  "Dashboard ID 10991: HikariCP — connection pool utilization",
                  "Dashboard ID 14046: RabbitMQ Overview — queue depths, consumer states",
                  "Grafana at 172.20.0.60:3000 (production compose profile only)",
                  "Auto-provisioned data source pointing to Prometheus at :9090",
                ]} />
            </div>
            <div className="bg-gray-900 rounded-2xl p-6 font-mono text-xs text-gray-300">
              <div className="text-green-400 font-bold mb-3">// Key Metrics Example (PromQL)</div>
              <div className="space-y-2">
                <div><span className="text-yellow-300">rate(http_server_requests_seconds_count[5m])</span><span className="text-gray-500"> # HTTP request rate</span></div>
                <div><span className="text-yellow-300">histogram_quantile(0.99, http_server_requests_seconds_bucket)</span><span className="text-gray-500"> # P99 latency</span></div>
                <div><span className="text-yellow-300">hikaricp_connections_active</span><span className="text-gray-500"> # Active DB connections</span></div>
                <div><span className="text-yellow-300">jvm_memory_used_bytes{"{area='heap'}"}</span><span className="text-gray-500"> # Heap usage</span></div>
                <div><span className="text-yellow-300">rabbitmq_queue_messages{"{queue='tally.creation.queue'}"}</span><span className="text-gray-500"> # Queue depth</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Optional Services tab */}
        {activeTab === "optional" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">Optional Platform Extensions</h2>
            <p className="text-gray-500 text-center mb-8">Infrastructure ready — enable by uncommenting in Docker Compose</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FeatureCard icon="⛓️" color="amber" title="Blockchain Ballot Anchoring"
                items={[
                  "VotingContract.sol (Solidity 0.8.19) deployed to local Ganache devnet",
                  "SHA-256 hash of each encrypted ballot anchored on-chain on cast",
                  "Immutable audit trail: hash cannot be altered post-recording",
                  "Voter verifies: call ballots[hash] on public node — returns election ID + timestamp",
                  "Flask microservice + Web3.py bridges Spring Boot to Ganache",
                  "/blockchain/verify/{trackingCode} REST endpoint for voter self-verification",
                  "For production: deploy VotingContract to persistent Ethereum L1/L2",
                ]} />
              <FeatureCard icon="🤖" color="teal" title="RAG AI Chatbot"
                items={[
                  "LangChain chunking: AmarVote User Guide + ElectionGuard Spec 2.1",
                  "ChromaDB vector store with sentence-transformers embeddings",
                  "DeepSeek-chat (OpenRouter API) as language model backbone",
                  "Answers questions grounded in official documentation",
                  "/rag/query: semantic question answering endpoint",
                  "/rag/search: similarity search without LLM generation",
                  "/rag/context: retrieve raw document chunks",
                  "/rag/reindex: trigger re-embedding of documentation",
                ]} />
            </div>
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <h3 className="font-bold text-amber-800 mb-2">⚠️ Enabling Optional Services</h3>
              <p className="text-amber-700 text-sm">Uncomment the respective service blocks in <code className="bg-white px-1 rounded text-xs border">docker-compose.yml</code>. The core 6-service platform (frontend, backend, EG API, EG Worker, RabbitMQ, Redis, PostgreSQL) runs without optional services with full E2E verifiability. Optional services add complementary capabilities.</p>
            </div>
          </div>
        )}

        {/* Navigation CTA */}
        <div className="mt-12 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Dive deeper into the platform</h2>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            <Link to="/architecture"><button className="px-5 py-2.5 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition text-sm">Architecture →</button></Link>
            <Link to="/security"><button className="px-5 py-2.5 border border-white/40 text-white font-semibold rounded-xl hover:bg-white/10 transition text-sm">Security Details →</button></Link>
            <Link to="/how-it-works"><button className="px-5 py-2.5 border border-white/40 text-white font-semibold rounded-xl hover:bg-white/10 transition text-sm">How It Works →</button></Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Features;

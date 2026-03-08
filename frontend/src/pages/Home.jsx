import React, { useState } from "react";
import { Link } from "react-router-dom";

const StatCard = ({ value, label, sub }) => (
  <div className="text-center px-6 py-4">
    <div className="text-3xl md:text-4xl font-extrabold text-blue-400">{value}</div>
    <div className="text-white font-semibold mt-1">{label}</div>
    {sub && <div className="text-blue-200 text-xs mt-1">{sub}</div>}
  </div>
);

const ServiceCard = ({ icon, title, tech, desc, color, ip, port }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-md hover:shadow-xl transition-all duration-300 p-6 hover:-translate-y-1">
    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-white text-xl mb-4 ${color}`}>
      {icon}
    </div>
    <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
    <div className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block mb-2">{tech}</div>
    {ip && <div className="text-xs text-gray-400 font-mono mb-2">{ip}{port ? ` · Port ${port}` : ""}</div>}
    <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
  </div>
);

const FeatureRow = ({ icon, title, desc }) => (
  <div className="flex items-start space-x-4 p-4 rounded-xl hover:bg-blue-50 transition-colors duration-200">
    <span className="text-2xl flex-shrink-0">{icon}</span>
    <div>
      <h4 className="font-semibold text-gray-900">{title}</h4>
      <p className="text-gray-600 text-sm mt-1">{desc}</p>
    </div>
  </div>
);

const Home = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">

      {/* ── Navigation ────────────────────────────────── */}
      <nav className="fixed w-full bg-white/95 backdrop-blur-lg shadow-md z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to="/" className="flex items-center group">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <span className="text-white text-lg">🗳️</span>
              </div>
              <span className="ml-2 text-xl font-extrabold bg-gradient-to-r from-gray-900 to-blue-700 bg-clip-text text-transparent">AmarVote</span>
            </Link>
            <div className="hidden md:flex items-center space-x-1">
              {[
                ["/features", "Features"],
                ["/how-it-works", "How It Works"],
                ["/architecture", "Architecture"],
                ["/security", "Security"],
                ["/about", "About"],
              ].map(([path, label]) => (
                <Link key={path} to={path} className="px-3 py-2 rounded-xl text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200">
                  {label}
                </Link>
              ))}
            </div>
            <div className="flex items-center space-x-3">
              <Link
                to="/admin-login"
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-500 hover:text-purple-700 hover:bg-purple-50 border border-transparent hover:border-purple-200 transition-all duration-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Admin
              </Link>
              <Link to="/otp-login">
                <button className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm font-medium text-sm">
                  Sign In
                </button>
              </Link>
              <button className="md:hidden p-2 rounded-lg" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                <span className="text-gray-700 text-xl">☰</span>
              </button>
            </div>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-3 space-y-1">
            {[
              ["/features", "Features"],
              ["/how-it-works", "How It Works"],
              ["/architecture", "Architecture"],
              ["/security", "Security"],
              ["/about", "About"],
            ].map(([path, label]) => (
              <Link key={path} to={path} className="block px-3 py-2 rounded-lg text-gray-700 hover:text-blue-600 hover:bg-blue-50 font-medium"
                onClick={() => setMobileMenuOpen(false)}>
                {label}
              </Link>
            ))}
            <Link to="/admin-login" className="flex items-center gap-2 px-3 py-2 rounded-lg text-purple-700 hover:bg-purple-50 font-medium"
              onClick={() => setMobileMenuOpen(false)}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Admin Login
            </Link>
          </div>
        )}
      </nav>

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="relative pt-24 pb-20 px-4 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        </div>
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-300 text-sm font-medium mb-6">
            <span className="mr-2">🔐</span>Powered by Microsoft ElectionGuard 2.x + NIST FIPS 203 ML-KEM-1024
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight mb-6">
            The Future of<br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Secure Voting
            </span>
          </h1>
          <p className="max-w-3xl mx-auto text-lg md:text-xl text-blue-100/80 mb-4 leading-relaxed">
            AmarVote is a cryptographically secure, end-to-end verifiable digital voting platform combining
            <strong className="text-white"> ElectionGuard's 4096-bit ElGamal encryption</strong>,
            <strong className="text-white"> post-quantum cryptography (ML-KEM-1024)</strong>,
            a <strong className="text-white">RabbitMQ worker architecture</strong> for large-scale processing,
            and optional <strong className="text-white">blockchain ballot anchoring</strong>.
          </p>
          <p className="max-w-2xl mx-auto text-blue-300/70 text-sm mb-10">
            Zero-knowledge proofs · Homomorphic tallying · Threshold decryption · Benaloh challenge · Bot detection · Traffic padding
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
            <Link to="/otp-login">
              <button className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-lg font-semibold rounded-2xl shadow-xl hover:shadow-blue-500/25 transition-all duration-300 hover:-translate-y-1">
                Get Started Free
              </button>
            </Link>
            <a href="https://youtu.be/ixsvvl_7qVo" target="_blank" rel="noopener noreferrer">
              <button className="px-8 py-4 border border-white/20 text-white text-lg font-semibold rounded-2xl hover:bg-white/10 transition-all duration-300 hover:-translate-y-1">
                ▶ Watch Demo
              </button>
            </a>
            <Link to="/architecture">
              <button className="px-8 py-4 border border-blue-400/30 text-blue-300 text-lg font-semibold rounded-2xl hover:bg-blue-500/10 transition-all duration-300 hover:-translate-y-1">
                View Architecture
              </button>
            </Link>
          </div>
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 rounded-2xl overflow-hidden border border-white/10 max-w-4xl mx-auto">
            <StatCard value="4096-bit" label="ElGamal Encryption" sub="ElectionGuard 2.x" />
            <StatCard value="ML-KEM-1024" label="Post-Quantum Keys" sub="NIST FIPS 203" />
            <StatCard value="200" label="Ballots/Chunk" sub="RabbitMQ chunked" />
            <StatCard value="4" label="Concurrent Workers" sub="prefetch=1 each" />
          </div>
        </div>
      </section>

      {/* ── Core Services ────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              A Complete Microservices Platform
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto text-lg">
              Six always-active services orchestrated with Docker Compose, plus optional blockchain and AI chatbot layers
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ServiceCard icon="⚛️" title="React Frontend" tech="React 19.1 · Vite 6 · Tailwind CSS" ip="172.20.0.40" port="5173 dev / 80 prod" color="bg-blue-500"
              desc="Responsive UI with animated results, real-time decryption progress, role-based dashboards for voters, guardians, and admins. FingerprintJS bot detection and PKCS#7 ballot padding built in." />
            <ServiceCard icon="☕" title="Spring Boot Backend" tech="Java 21 · Spring Boot 3.5 · Maven" ip="172.20.0.30" port="8080" color="bg-green-600"
              desc="Central orchestration hub. Handles authentication (OTP + JWT), election management, cryptographic delegation, Cloudinary image upload, Gmail SMTP, Prometheus metrics, and all REST API endpoints." />
            <ServiceCard icon="🔐" title="ElectionGuard Microservice" tech="Python 3.12 · Flask · MS ElectionGuard SDK" ip="172.20.0.10/11" port="5000 fast / 5001 worker" color="bg-purple-600"
              desc="Two-container split: fast API handles guardian key ceremony and ballot encryption; worker handles tally creation, partial/compensated decryption, and combine operations." />
            <ServiceCard icon="🐰" title="RabbitMQ" tech="RabbitMQ 3.13 · Spring AMQP" ip="172.20.0.60/25" port="5672 AMQP / 15672 UI" color="bg-orange-500"
              desc="Four durable queues with prefetch=1 consumers. Fair round-robin scheduler ensures no single election monopolizes all workers. Supports 10,000+ ballot elections by chunking into 200-ballot pieces." />
            <ServiceCard icon="💾" title="Redis" tech="Redis 7 Alpine · Lettuce" ip="172.20.0.70/75" port="6379" color="bg-red-500"
              desc="Three roles: guardian private-key cache (6h TTL); phase completion counters with atomic INCR for self-coordinating worker phases; SET NX distributed locks preventing double-processing." />
            <ServiceCard icon="🗄️" title="PostgreSQL" tech="PostgreSQL 15 Alpine · Hibernate JPA" ip="172.20.0.20" port="5432 prod / Neon Cloud dev" color="bg-sky-600"
              desc="14-table schema. Stores elections, guardians, ballots, encrypted tallies, partial decryptions, compensated decryptions, election results, jobs, and comprehensive API audit logs." />
          </div>
          <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-2xl">
            <h3 className="text-lg font-bold text-amber-800 mb-4 text-center">⚡ Optional Services (Infrastructure Ready — Uncomment to Enable)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-4 border border-amber-100">
                <div className="font-bold text-gray-900 mb-1">⛓️ Blockchain Layer</div>
                <div className="text-xs text-gray-500 font-mono mb-2">Ganache · Solidity 0.8.19 · Web3.py · Flask · Port 5002</div>
                <p className="text-sm text-gray-700">Ethereum-compatible VotingContract.sol records SHA-256 ballot hashes. Voters verify their ballot at any time using their tracking code. Immutable, append-only audit trail.</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-amber-100">
                <div className="font-bold text-gray-900 mb-1">🤖 RAG AI Chatbot</div>
                <div className="text-xs text-gray-500 font-mono mb-2">LangChain · ChromaDB · sentence-transformers · DeepSeek · Port 5001</div>
                <p className="text-sm text-gray-700">Indexes AmarVote User Guide + ElectionGuard Spec 2.1. Answers questions grounded in documentation. /search, /context, /reindex endpoints.</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-amber-100">
                <div className="font-bold text-gray-900 mb-1">📊 Prometheus + Grafana</div>
                <div className="text-xs text-gray-500 font-mono mb-2">Production only · Port 9090 / 3000</div>
                <p className="text-sm text-gray-700">Scrapes Micrometer from Spring Boot Actuator every 15s. Pre-configured dashboards (IDs: 4701, 6756, 10991, 14046) for JVM, HTTP, RabbitMQ, HikariCP monitoring.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Cryptographic Security ────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">Uncompromising Cryptographic Security</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Every layer of AmarVote is designed with cryptographic integrity</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div className="space-y-2">
              {[
                ["🔒", "ElGamal Homomorphic Encryption (4096-bit)", "Each vote is encrypted with ElectionGuard's 4096-bit ElGamal scheme. Encrypted votes can be multiplied together to produce an encrypted total — votes are tallied without ever being decrypted."],
                ["🧮", "Threshold Decryption (k-of-n Shamir Secret Sharing)", "Election results require a quorum of k guardians out of n to decrypt. Each guardian holds a secret share via degree-(k-1) polynomial. Absent guardians: present ones use Lagrange interpolation on polynomial backups to compensate."],
                ["🛡️", "Post-Quantum Key Protection (ML-KEM-1024 / Kyber)", "Guardian ElGamal private keys wrapped using ML-KEM-1024 (CRYSTALS-Kyber, NIST FIPS 203 standardized). Resistant to Shor's algorithm. Combined with AES-256-CBC and Scrypt KDF (N=2^16)."],
                ["✅", "Zero-Knowledge Proofs (Chaum-Pedersen / Schnorr)", "Every ballot carries a ZK proof of validity — proving the voter selected exactly one candidate — without revealing which one. Decryption shares also include Chaum-Pedersen proofs downloadable for independent verification."],
                ["🔍", "Benaloh Challenge (Cast-or-Spoil)", "After encryption, before casting, voters may demand the encryption nonce, revealing how their ballot was encrypted. Spoiled ballots are publicly auditable, proving encryption was honest. Voter may re-vote after a challenge."],
                ["🕵️", "Ballot Traffic Protection (PKCS#7 Padding)", "All ballot submission requests are padded to a fixed size using PKCS#7. This prevents traffic analysis — an eavesdropper cannot infer election popularity by monitoring request sizes."],
                ["🤖", "Bot Detection (FingerprintJS BotD 1.9.1)", "Frontend performs bot detection before ballot submission. Bot requests or stale timestamps (>5 minutes) are rejected with HTTP 403. Bot detection result plus timestamp is validated server-side."],
              ].map(([icon, title, desc]) => (
                <div key={title} className="flex items-start space-x-4 p-4 rounded-xl hover:bg-blue-50 transition-colors duration-200">
                  <span className="text-2xl flex-shrink-0">{icon}</span>
                  <div>
                    <h4 className="font-semibold text-gray-900">{title}</h4>
                    <p className="text-gray-600 text-sm mt-1">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className="bg-gray-900 rounded-2xl p-6 text-sm font-mono mb-6">
                <div className="text-green-400 font-bold mb-4 text-base">// Cryptographic Specification</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-700">
                      <th className="text-left pb-2">Layer</th>
                      <th className="text-left pb-2">Algorithm</th>
                      <th className="text-left pb-2">Standard</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    {[
                      ["Vote Encryption", "ElGamal 4096-bit", "ElectionGuard 2.1"],
                      ["Guardian Keys", "ML-KEM-1024 (Kyber)", "NIST FIPS 203"],
                      ["Symmetric Wrap", "AES-256-CBC", "FIPS 197"],
                      ["Key Derivation", "Scrypt N=65536", "RFC 7914"],
                      ["Session Tokens", "HMAC-SHA256 / JWT", "RFC 7519"],
                      ["Ballot Hashing", "SHA-256", "FIPS 180-4"],
                      ["Passwords", "BCrypt strength=12", "—"],
                      ["Blockchain (opt)", "ECDSA / keccak256", "Ethereum EIP-55"],
                      ["ZK Proofs", "Chaum-Pedersen", "ElectionGuard Spec"],
                      ["Ballot Validity", "Schnorr σ-protocol", "ElectionGuard Spec"],
                      ["Serialization", "msgpack binary", "10–50× vs JSON"],
                    ].map(([layer, algo, std]) => (
                      <tr key={layer} className="border-b border-gray-800">
                        <td className="py-1.5 text-blue-300">{layer}</td>
                        <td className="py-1.5 text-yellow-300">{algo}</td>
                        <td className="py-1.5 text-gray-400">{std}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
                <h3 className="font-bold text-green-800 text-lg mb-4">🔎 End-to-End Verifiability</h3>
                {[
                  ["1", "Ballot Cast", "Tracking code on public bulletin board"],
                  ["2", "Ballot Integrity", "Ciphertext matches bulletin board entry"],
                  ["3", "Ballot Counted", "Included in homomorphic encrypted tally"],
                  ["4", "Tally Correct", "Download & verify Chaum-Pedersen proofs"],
                  ["5", "Blockchain Anchor", "Transaction hash proves pre-election recording (optional)"],
                ].map(([n, title, desc]) => (
                  <div key={n} className="flex items-start mb-3">
                    <div className="w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mr-3 mt-0.5">{n}</div>
                    <div>
                      <span className="font-semibold text-green-900">{title}</span>
                      <span className="text-green-700 text-sm ml-2">— {desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── RabbitMQ Architecture ─────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">RabbitMQ Worker Architecture</h2>
            <p className="text-blue-200 max-w-3xl mx-auto">
              Large elections with 10,000+ ballots require chunked, fault-tolerant async processing. A single HTTP request would cause OutOfMemoryError — RabbitMQ solves this.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div>
              <h3 className="text-white font-bold text-lg mb-4">4 Processing Queues</h3>
              <div className="space-y-3">
                {[
                  ["🔢", "tally.creation.queue", "task.tally.creation", "Converts ballot ciphertexts → encrypted tally chunk (200 ballots at a time, SecureRandom shuffled)"],
                  ["🔑", "partial.decryption.queue", "task.partial.decryption", "Each guardian partially decrypts one tally chunk using their private key from Redis (6h TTL)"],
                  ["🔄", "compensated.decryption.queue", "task.compensated.decryption", "Present guardians reconstruct absent guardians' shares via Lagrange interpolation on polynomial backups"],
                  ["🎯", "combine.decryption.queue", "task.combine.decryption", "Assembles all partial shares → final vote counts + Chaum-Pedersen proofs; sets election status = decrypted"],
                ].map(([icon, queue, routing, desc]) => (
                  <div key={queue} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-start">
                      <span className="text-xl mr-3 mt-0.5">{icon}</span>
                      <div>
                        <div className="font-mono text-blue-300 text-sm font-bold">{queue}</div>
                        <div className="font-mono text-gray-500 text-xs mb-1">routing: {routing}</div>
                        <p className="text-gray-300 text-sm">{desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg mb-4">Fair Round-Robin Scheduler</h3>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-4">
                <div className="font-mono text-green-400 text-xs mb-3">// RoundRobinTaskScheduler — 100ms tick</div>
                <pre className="text-gray-300 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap">{`Every 100ms (TARGET_CHUNKS_PER_CYCLE = 8):
  For each active task (round-robin order):
    If queued < MAX_QUEUED_CHUNKS (1):
      Pop next PENDING chunk
      Mark chunk as QUEUED
      Publish to RabbitMQ exchange

// Ensures FAIR interleaving across elections:
// Election A (500 chunks) + Election B (50 chunks)
// Tick 1 → A, B, A, B ... not A×500 then B×50

// Retry: 3 attempts, exponential backoff
// 5s → 10s → 20s → PERMANENTLY_FAILED

// Task ID format:
// TALLY_e42_1704067200000
// PARTIAL_DECRYPT_e42_g3_1704067200000`}</pre>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["prefetch=1", "Consumer takes next message only after completing current one"],
                  ["4 consumers/queue", "Min=max=4 concurrent Spring AMQP listeners"],
                  ["Distributed lock", "ConcurrentHashMap + Redis SET NX prevents duplicate processing"],
                  ["Memory safe", "entityManager.clear() + System.gc() after each chunk"],
                  ["Redis counters", "Atomic INCR per chunk; SET NX triggers phase 2 exactly once"],
                  ["Durable queues", "Messages survive RabbitMQ restarts; defaultRequeueRejected=false"],
                ].map(([k, v]) => (
                  <div key={k} className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <div className="font-mono text-yellow-300 text-xs font-bold">{k}</div>
                    <div className="text-gray-400 text-xs mt-1">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Roles Overview ───────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">Three Roles, One Platform</h2>
            <p className="text-gray-600 max-w-xl mx-auto">Passwordless OTP login, JWT sessions, role-based access control</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[
              {
                icon: "🗳️", title: "Voter", color: "blue",
                features: [
                  "OTP login (6-digit, 5-min TTL via Gmail SMTP)",
                  "Browse public & eligible restricted elections",
                  "Encrypt ballot, optionally Benaloh challenge",
                  "Cast ballot; receive unique tracking code",
                  "Verify ballot inclusion post-election",
                  "FingerprintJS BotD + server-side timestamp check",
                ]
              },
              {
                icon: "🔑", title: "Guardian", color: "purple",
                features: [
                  "Receive ML-KEM-1024-wrapped credentials via email",
                  "Submit credentials to initiate partial decryption",
                  "Private key decrypted → stored in Redis 6h TTL",
                  "Workers use key per chunk across all ballot groups",
                  "Absent guardians: Lagrange compensation by present ones",
                  "Marked decrypted_or_not = true when complete",
                ]
              },
              {
                icon: "⚙️", title: "Admin / Creator", color: "green",
                features: [
                  "Create election: guardians, quorum, candidates",
                  "Key ceremony: ElectionGuard generates guardian keypairs",
                  "Upload images to Cloudinary (candidate/party/election)",
                  "Eligibility: open / restricted / listed / unlisted",
                  "Initiate tally → RabbitMQ chunks all cast ballots",
                  "Initiate combine after all guardians contribute shares",
                ]
              }
            ].map(({ icon, title, color, features }) => (
              <div key={title} className={`rounded-2xl p-6 border ${color === "blue" ? "bg-blue-50 border-blue-100" : color === "purple" ? "bg-purple-50 border-purple-100" : "bg-green-50 border-green-100"}`}>
                <div className="text-3xl mb-3">{icon}</div>
                <h3 className={`text-xl font-bold mb-4 ${color === "blue" ? "text-blue-800" : color === "purple" ? "text-purple-800" : "text-green-800"}`}>{title}</h3>
                <ul className="space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-start text-sm text-gray-700">
                      <span className="mr-2 text-gray-400 flex-shrink-0">•</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Video Demos ───────────────────────────────── */}
      <section className="py-20 bg-indigo-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">Video Demonstrations</h2>
          <p className="text-indigo-200 mb-10">See AmarVote in action — platform walkthrough and infrastructure deep dive</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <a href="https://youtu.be/ixsvvl_7qVo" target="_blank" rel="noopener noreferrer"
              className="group block bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all duration-300 hover:-translate-y-1">
              <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center text-white text-2xl mx-auto mb-4 group-hover:scale-110 transition-transform">▶</div>
              <h3 className="text-xl font-bold text-white mb-2">Platform Features Demo</h3>
              <p className="text-indigo-200 text-sm">Full walkthrough of election creation, ballot casting, guardian decryption, results verification</p>
              <div className="mt-4 text-indigo-300 font-mono text-xs">youtu.be/ixsvvl_7qVo</div>
            </a>
            <a href="https://youtu.be/t8VOLdYIV40" target="_blank" rel="noopener noreferrer"
              className="group block bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all duration-300 hover:-translate-y-1">
              <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center text-white text-2xl mx-auto mb-4 group-hover:scale-110 transition-transform">🏗️</div>
              <h3 className="text-xl font-bold text-white mb-2">Infrastructure Overview</h3>
              <p className="text-indigo-200 text-sm">Docker services, RabbitMQ architecture, Redis coordination, ElectionGuard microservice split</p>
              <div className="mt-4 text-indigo-300 font-mono text-xs">youtu.be/t8VOLdYIV40</div>
            </a>
          </div>
        </div>
      </section>

      {/* ── Tech Stack ───────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">Complete Technology Stack</h2>
            <p className="text-gray-600">Every dependency chosen with precision for performance, security, and reliability</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                label: "Frontend", icon: "⚛️", bg: "bg-blue-50 border-blue-200",
                items: [
                  ["React", "19.1.0", "UI Framework"],
                  ["Vite", "6.3.5", "Build Tool"],
                  ["Tailwind CSS", "3.4.17", "Styling"],
                  ["Framer Motion", "12.23.26", "Animations"],
                  ["Recharts", "2.8.0", "Result charts"],
                  ["FingerprintJS BotD", "1.9.1", "Bot detection"],
                  ["jsPDF + autotable", "2.5.1 / 3.6.0", "PDF export"],
                  ["Axios", "1.9.0", "HTTP client"],
                  ["Vitest", "3.2.4", "Testing"],
                ]
              },
              {
                label: "Backend", icon: "☕", bg: "bg-green-50 border-green-200",
                items: [
                  ["Java / Spring Boot", "21 / 3.5.0", "Core runtime"],
                  ["Spring Security", "6.x", "Auth + CSRF"],
                  ["JJWT", "0.12.6", "JWT tokens"],
                  ["Spring AMQP", "✓", "RabbitMQ client"],
                  ["Spring Data Redis", "✓", "Lettuce driver"],
                  ["Resilience4j", "2.1.0", "Circuit breaker"],
                  ["Jackson-msgpack", "0.9.8", "Binary transport"],
                  ["Cloudinary SDK", "1.38.0", "Image store"],
                  ["Micrometer + Prom", "✓", "Metrics"],
                ]
              },
              {
                label: "Crypto + Infra", icon: "🔐", bg: "bg-purple-50 border-purple-200",
                items: [
                  ["ElectionGuard SDK", "2.x", "E2E-V crypto"],
                  ["pqcrypto ML-KEM-1024", "✓", "Post-quantum KEM"],
                  ["cryptography", "✓", "AES-CBC, Scrypt"],
                  ["gmpy2", "✓", "GMP big-integer"],
                  ["msgpack", "✓", "Fast serialization"],
                  ["PostgreSQL", "15 Alpine", "Primary DB"],
                  ["RabbitMQ", "3.13", "Task queuing"],
                  ["Redis", "7 Alpine", "Cache + locks"],
                  ["DeepSeek (OpenRouter)", "chat-v3-0324", "AI chatbot"],
                ]
              }
            ].map(({ label, icon, bg, items }) => (
              <div key={label} className={`rounded-2xl border p-6 ${bg}`}>
                <h3 className="font-bold text-gray-900 text-lg mb-4">{icon} {label}</h3>
                <div className="space-y-1.5">
                  {items.map(([name, ver, purpose]) => (
                    <div key={name} className="flex justify-between items-center bg-white/70 rounded-lg px-3 py-1.5">
                      <div>
                        <span className="font-semibold text-gray-800 text-sm">{name}</span>
                        <span className="text-gray-500 text-xs ml-2">{purpose}</span>
                      </div>
                      <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded flex-shrink-0 ml-2">{ver}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
            Ready to run a cryptographically secure election?
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            Sign in with just your email — no password required. OTP delivered instantly.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/otp-login">
              <button className="px-8 py-4 bg-white text-blue-700 text-lg font-bold rounded-2xl hover:bg-blue-50 transition-all duration-300 shadow-xl hover:-translate-y-1">
                Get Started Free →
              </button>
            </Link>
            <Link to="/security">
              <button className="px-8 py-4 border border-white/40 text-white text-lg font-semibold rounded-2xl hover:bg-white/10 transition-all duration-300">
                Read Security Details
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────── */}
      <footer className="bg-gray-950 text-gray-400">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-8">
            <div className="col-span-2">
              <div className="flex items-center mb-4">
                <span className="text-2xl">🗳️</span>
                <span className="ml-2 text-white font-extrabold text-lg">AmarVote</span>
              </div>
              <p className="text-sm leading-relaxed">End-to-end verifiable digital voting platform powered by Microsoft ElectionGuard, post-quantum cryptography, and RabbitMQ worker architecture.</p>
            </div>
            <div>
              <h4 className="text-gray-300 font-semibold mb-3 text-sm uppercase tracking-wider">Platform</h4>
              <ul className="space-y-2 text-sm">
                {[["/features", "Features"], ["/how-it-works", "How It Works"], ["/architecture", "Architecture"], ["/security", "Security"]].map(([p, l]) => (
                  <li key={p}><Link to={p} className="hover:text-white transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-gray-300 font-semibold mb-3 text-sm uppercase tracking-wider">Learn</h4>
              <ul className="space-y-2 text-sm">
                {[["/about", "About"], ["/api-logs", "API Logs"], ["/otp-login", "Sign In"]].map(([p, l]) => (
                  <li key={p}><Link to={p} className="hover:text-white transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-gray-300 font-semibold mb-3 text-sm uppercase tracking-wider">Demos</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://youtu.be/ixsvvl_7qVo" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Platform Demo ↗</a></li>
                <li><a href="https://youtu.be/t8VOLdYIV40" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Infra Demo ↗</a></li>
                <li><a href="https://github.com/microsoft/electionguard" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">ElectionGuard ↗</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-sm text-center text-gray-500">
            © {new Date().getFullYear()} AmarVote. MIT License. Built with ElectionGuard, Spring Boot, React, RabbitMQ, Redis, and PostgreSQL.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;

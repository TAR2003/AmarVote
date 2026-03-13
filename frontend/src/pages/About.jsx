import React, { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "./Layout";

const TRow = ({ label, value, sub }) => (
  <tr className="border-b border-gray-100 even:bg-gray-50">
    <td className="py-2.5 px-4 text-sm font-medium text-gray-700 whitespace-nowrap">{label}</td>
    <td className="py-2.5 px-4 text-sm text-gray-900 font-semibold">{value}</td>
    {sub && <td className="py-2.5 px-4 text-xs text-gray-500">{sub}</td>}
  </tr>
);

const ServiceCard = ({ icon, name, color, tags, description }) => {
  const colors = {
    blue: "border-blue-200 bg-blue-50",
    green: "border-green-200 bg-green-50",
    purple: "border-purple-200 bg-purple-50",
    orange: "border-orange-200 bg-orange-50",
    teal: "border-teal-200 bg-teal-50",
    indigo: "border-indigo-200 bg-indigo-50",
    red: "border-red-200 bg-red-50",
    gray: "border-gray-200 bg-gray-50",
  };
  const tagColor = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    purple: "bg-purple-100 text-purple-700",
    orange: "bg-orange-100 text-orange-700",
    teal: "bg-teal-100 text-teal-700",
    indigo: "bg-indigo-100 text-indigo-700",
    red: "bg-red-100 text-red-700",
    gray: "bg-gray-100 text-gray-700",
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[color]}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="font-bold text-gray-900">{name}</span>
      </div>
      <p className="text-sm text-gray-600 mb-3">{description}</p>
      <div className="flex flex-wrap gap-1">
        {tags.map((t) => (
          <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tagColor[color]}`}>{t}</span>
        ))}
      </div>
    </div>
  );
};

function About() {
  const [tab, setTab] = useState("overview");

  return (
    <Layout>
      {/* Hero */}
      <div className="bg-gradient-to-br from-gray-900 to-blue-950 py-16 px-4 text-center">
        <div className="inline-flex items-center px-4 py-2 bg-blue-500/10 border border-blue-400/30 rounded-full text-blue-300 text-sm font-medium mb-6">
          <span className="mr-2">ðŸ—³ï¸</span>End-to-End Verifiable E-Voting Platform
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">About AmarVote</h1>
        <p className="text-blue-200/80 text-lg max-w-3xl mx-auto mb-8">
          AmarVote is a production-grade open-source electronic voting system built on ElectionGuard 2.x threshold cryptography, post-quantum ML-KEM-1024 key protection, and a microservices 
          architecture delivering privacy, verifiability, and resiliency at scale.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a href="https://youtu.be/ixsvvl_7qVo" target="_blank" rel="noreferrer">
            <button className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition text-sm">â–¶ Demo Video 1</button>
          </a>
          <a href="https://youtu.be/t8VOLdYIV40" target="_blank" rel="noreferrer">
            <button className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition text-sm">â–¶ Demo Video 2</button>
          </a>
          <Link to="/architecture">
            <button className="px-5 py-2.5 border border-blue-300/40 text-white font-semibold rounded-xl hover:bg-white/10 transition text-sm">Architecture â†’</button>
          </Link>
          <Link to="/security">
            <button className="px-5 py-2.5 border border-blue-300/40 text-white font-semibold rounded-xl hover:bg-white/10 transition text-sm">Security â†’</button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white sticky top-16 z-20">
        <div className="max-w-6xl mx-auto px-4 flex overflow-x-auto">
          {[
            ["overview", "ðŸ“– Overview"],
            ["stack", "ðŸ›  Tech Stack"],
            ["services", "ðŸ”§ Services"],
            ["crypto", "ðŸ” Cryptography"],
            ["team", "ðŸ‘¥ Project"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="space-y-10">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">What is AmarVote?</h2>
              <p className="text-gray-600 leading-relaxed">
                AmarVote is a fully self-hosted, end-to-end verifiable e-voting platform. Every ballot is encrypted on the client 
                using ElectionGuard's ElGamal scheme before it ever leaves the browser. Homomorphic tallying accumulates encrypted 
                votes without decrypting individual ballots, and a threshold of k-of-n guardians jointly decrypts using Lagrange 
                interpolation. Zero-knowledge Schnorr and Chaum-Pedersen proofs are published alongside every result so any 
                independent party can audit the election.
              </p>
            </div>

            {/* Key stats */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ["4096-bit", "Prime field for ElGamal"],
                ["ML-KEM-1024", "Post-quantum key wrap"],
                ["k-of-n", "Threshold guardian system"],
                ["200 ballots/chunk", "RabbitMQ processing unit"],
              ].map(([v, l]) => (
                <div key={v} className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-center">
                  <div className="text-2xl font-extrabold text-white">{v}</div>
                  <div className="text-blue-200 text-xs mt-1">{l}</div>
                </div>
              ))}
            </div>

            {/* Roles */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Three Participant Roles</h2>
              <div className="grid md:grid-cols-3 gap-5">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                  <div className="font-bold text-blue-800 mb-2 text-lg">ðŸªª Voter</div>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>â†’ OTP login (email, no password)</li>
                    <li>â†’ Browse eligible elections</li>
                    <li>â†’ Cast encrypted ballot or challenge (Benaloh)</li>
                    <li>â†’ Verify ballot inclusion via tracking code</li>
                    <li>â†’ View animated results after decryption</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
                  <div className="font-bold text-purple-800 mb-2 text-lg">ðŸ”‘ Guardian</div>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>â†’ Receives ML-KEM-1024 encrypted credential.json</li>
                    <li>â†’ Holds ElGamal private key share s_i</li>
                    <li>â†’ Submits credentials for decryption phase</li>
                    <li>â†’ Minimum quorum k must participate</li>
                    <li>â†’ Absent guardians covered by Lagrange compensation</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
                  <div className="font-bold text-orange-800 mb-2 text-lg">âš™ Admin</div>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>â†’ Create elections with guardian parameters</li>
                    <li>â†’ Manage voter eligibility lists</li>
                    <li>â†’ Monitor RabbitMQ + Redis via dashboard</li>
                    <li>â†’ Initiate tally and guardian prompts</li>
                    <li>â†’ Export results PDF (jsPDF + autotable)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Public pages */}
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">Public Pages (no login required)</h2>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  ["/", "Home", "Platform overview, architecture, RabbitMQ, roles, video demos"],
                  ["/features", "Features", "6-tab: Cryptography, Architecture, Security, Election, Monitoring, Optional"],
                  ["/how-it-works", "How It Works", "6-phase step-by-step: Auth â†’ Setup â†’ Casting â†’ Tally â†’ Decrypt â†’ Verify"],
                  ["/architecture", "Architecture", "6-tab: Services, Network, DataFlow, RabbitMQ, Redis"],
                  ["/security", "Security", "7-tab: ElGamal, ML-KEM, ZK Proofs, Benaloh, Auth, Transport"],
                  ["/about", "About", "This page"],
                ].map(([path, name, desc]) => (
                  <Link key={path} to={path} className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300 transition">
                    <div className="font-bold text-gray-900 text-sm">{name}</div>
                    <div className="text-xs text-blue-600 font-mono mb-1">{path}</div>
                    <div className="text-xs text-gray-500">{desc}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TECH STACK */}
        {tab === "stack" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Complete Technology Stack</h2>
              <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-900 text-white text-sm">
                    <tr>
                      <th className="text-left py-3 px-4">Library / Tool</th>
                      <th className="text-left py-3 px-4">Version</th>
                      <th className="text-left py-3 px-4">Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-blue-50"><td colSpan={3} className="px-4 py-2 text-xs font-bold text-blue-700 uppercase tracking-wider">Frontend</td></tr>
                    <TRow label="React" value="19.1.0" sub="UI framework with hooks and reactive rendering" />
                    <TRow label="Vite" value="6.3.5" sub="Build tool + dev server (HMR)" />
                    <TRow label="Tailwind CSS" value="3.4.17" sub="Utility-first CSS framework" />
                    <TRow label="React Router" value="7.6.2" sub="Client-side routing (SPA)" />
                    <TRow label="Recharts" value="latest" sub="Animated election results chart" />
                    <TRow label="Framer Motion" value="latest" sub="Results animation and page transitions" />
                    <TRow label="jsPDF + autotable" value="latest" sub="PDF export for election results" />
                    <TRow label="FingerprintJS BotD" value="1.9.1" sub="Bot detection before ballot submission" />
                    <TRow label="Cloudinary SDK" value="1.38.0" sub="Candidate & party image management" />

                    <tr className="bg-green-50"><td colSpan={3} className="px-4 py-2 text-xs font-bold text-green-700 uppercase tracking-wider">Backend (Spring Boot)</td></tr>
                    <TRow label="Java" value="21 (LTS)" sub="Primary backend language" />
                    <TRow label="Spring Boot" value="3.5.0" sub="Application framework + REST API" />
                    <TRow label="Spring Security" value="6.x" sub="JWT auth, RBAC, CSRF protection" />
                    <TRow label="JJWT" value="9.x" sub="JWT generation and validation (HMAC-SHA256)" />
                    <TRow label="PostgreSQL driver" value="42.7" sub="JDBC driver for Postgres 15" />
                    <TRow label="Spring Data JPA" value="3.5" sub="ORM + repository layer (Hibernate)" />
                    <TRow label="RabbitMQ AMQP" value="3.13" sub="Async message broker for election jobs" />
                    <TRow label="Spring Data Redis" value="3.x" sub="Redis client (Lettuce) â€” keys, counters, locks" />
                    <TRow label="Bouncy Castle" value="1.78" sub="ML-KEM-1024, AES-256-CBC, Scrypt, HMAC-SHA256" />
                    <TRow label="Spring Mail" value="3.x" sub="OTP + credential delivery via Gmail SMTP" />
                    <TRow label="msgpack" value="1.1" sub="Compact binary serialization for ballot blobs" />

                    <tr className="bg-purple-50"><td colSpan={3} className="px-4 py-2 text-xs font-bold text-purple-700 uppercase tracking-wider">ElectionGuard Microservice (Python)</td></tr>
                    <TRow label="ElectionGuard" value="2.x" sub="Core cryptographic library (MIT, by Microsoft)" />
                    <TRow label="FastAPI" value="0.115.x" sub="Async HTTP API for EG endpoints" />
                    <TRow label="Celery" value="5.x" sub="Distributed task worker (EG Worker)" />
                    <TRow label="pika" value="1.3.x" sub="RabbitMQ AMQP 0.9 client for Python workers" />
                    <TRow label="msgpack-python" value="1.1" sub="Ballot blob deserialization in workers" />

                    <tr className="bg-orange-50"><td colSpan={3} className="px-4 py-2 text-xs font-bold text-orange-700 uppercase tracking-wider">Infrastructure</td></tr>
                    <TRow label="PostgreSQL" value="15" sub="Primary relational DB â€” 14-table schema" />
                    <TRow label="Redis" value="7 Alpine" sub="Guardian key cache (6h TTL), atomic counters, SET NX locks" />
                    <TRow label="RabbitMQ" value="3.13" sub="4 durable queues, prefetch=1, management UI on :15672" />
                    <TRow label="Nginx" value="Alpine" sub="Reverse proxy + TLS termination; routes /api/* and /ws/*" />
                    <TRow label="Docker Compose" value="3.8" sub="Container orchestration (prod + dev configs)" />
                    <TRow label="Prometheus" value="latest" sub="Metrics scraping (optional monitoring)" />
                    <TRow label="Grafana" value="latest" sub="Dashboard visualization (optional monitoring)" />

                    <tr className="bg-teal-50"><td colSpan={3} className="px-4 py-2 text-xs font-bold text-teal-700 uppercase tracking-wider">Optional Services</td></tr>
                    <TRow label="LangChain" value="0.3.x" sub="RAG chatbot orchestration" />
                    <TRow label="ChromaDB" value="0.6.x" sub="Vector store for documentation search" />
                    <TRow label="DeepSeek" value="API" sub="LLM for RAG chatbot responses" />
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SERVICES */}
        {tab === "services" && (
          <div className="space-y-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Microservices Architecture</h2>
            <p className="text-gray-600 text-sm mb-6">All services run as isolated Docker containers on a 172.20.0.0/24 overlay network with static IPs.</p>

            <div className="grid md:grid-cols-2 gap-5">
              <ServiceCard icon="ðŸŒ" name="React Frontend" color="blue"
                tags={["172.20.0.40", "Vite dev server / Nginx prod"]}
                description="React 19.1 + Vite 6 SPA. Handles ballot encryption, bot detection, eligibility UI, animated results, and PDF export. Communicates only with Spring Boot via REST." />
              <ServiceCard icon="â˜•" name="Spring Boot Backend" color="green"
                tags={["172.20.0.30", "Port 8080", "Java 21", "REST + RabbitMQ producer"]}
                description="Core orchestration layer. Manages authentication (OTP + JWT), election lifecycle, guardian credential processing, ballot storage, and RabbitMQ job publishing with fair round-robin scheduler." />
              <ServiceCard icon="âš¡" name="EG Fast API" color="purple"
                tags={["172.20.0.10", "Port 5000", "FastAPI", "Python 3.12"]}
                description="Synchronous ElectionGuard endpoints: /ceremony/setup, /ballot/encrypt, /ballot/challenge, and ZK proof generation. Handles key ceremony and per-voter encryption requests." />
              <ServiceCard icon="âš™ï¸" name="EG Worker" color="orange"
                tags={["172.20.0.11", "Port 5001", "Celery", "4 consumers"]}
                description="Async RabbitMQ consumer. Processes tally.creation, partial.decryption, compensated.decryption, and combine.decryption queues. Each worker handles 1 chunk at a time (prefetch=1)." />
              <ServiceCard icon="ðŸ—ƒï¸" name="PostgreSQL 15" color="teal"
                tags={["172.20.0.20", "Port 5432", "14-table schema"]}
                description="Primary persistent store. Tables: users, elections, ballots, encrypted_tally, election_result, partial_decryption, compensated_decryption, guardian_keys, otp, election_jobs, audit_records, voting_sessions, voter_eligibility, candidates." />
              <ServiceCard icon="âš¡" name="Redis 7" color="indigo"
                tags={["172.20.0.70", "Port 6379", "Replica: 172.20.0.75"]}
                description="Three use cases: guardian:{id}:key (SET, 6h TTL), tally_complete:{electionId} (INCR atomic counter), lock:chunk:{id}:{guardianId} (SET NX distributed lock). Read replica for high availability." />
              <ServiceCard icon="ðŸ‡" name="RabbitMQ 3.13" color="red"
                tags={["172.20.0.60", ":5672 AMQP", ":15672 Mgmt"]}
                description="Message broker with 4 durable queues: tally.creation, partial.decryption, compensated.decryption, combine.decryption. prefetch=1 ensures fair load across 4 concurrent consumers. Dead letter exchange configured for failed jobs." />
              <ServiceCard icon="ðŸ”€" name="Nginx Reverse Proxy" color="gray"
                tags={["172.20.0.80", "Port 80/443"]}
                description="TLS termination + request routing. /api/* â†’ Spring Boot :8080. /ws/* â†’ WebSocket connections. /* â†’ React app. Upstream keepalive 32. Also serves static files in production." />
            </div>

            {/* Network table */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Static IP Assignment (172.20.0.0/24)</h3>
              <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-900 text-white">
                    <tr>
                      <th className="text-left py-2 px-4">IP</th>
                      <th className="text-left py-2 px-4">Service</th>
                      <th className="text-left py-2 px-4">Port(s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["172.20.0.10", "ElectionGuard Fast API", "5000"],
                      ["172.20.0.11", "ElectionGuard Worker", "5001"],
                      ["172.20.0.20", "PostgreSQL 15", "5432"],
                      ["172.20.0.30", "Spring Boot Backend", "8080"],
                      ["172.20.0.40", "React Frontend", "3000 (dev)"],
                      ["172.20.0.50", "Nginx Proxy", "80 / 443"],
                      ["172.20.0.60", "RabbitMQ", "5672 / 15672"],
                      ["172.20.0.70", "Redis Primary", "6379"],
                      ["172.20.0.75", "Redis Replica", "6379"],
                      ["172.20.0.90", "Prometheus", "9090"],
                      ["172.20.0.91", "Grafana", "3000"],
                      ["172.20.0.101", "RAG Service", "8000"],
                    ].map(([ip, name, port]) => (
                      <tr key={ip} className="border-b border-gray-100 even:bg-gray-50">
                        <td className="py-2 px-4 font-mono text-xs text-blue-700">{ip}</td>
                        <td className="py-2 px-4">{name}</td>
                        <td className="py-2 px-4 font-mono text-gray-500">{port}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CRYPTO */}
        {tab === "crypto" && (
          <div className="space-y-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Cryptographic Design</h2>

            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full">
                <thead className="bg-gray-900 text-white text-sm">
                  <tr>
                    <th className="text-left py-3 px-4">Algorithm</th>
                    <th className="text-left py-3 px-4">Standard</th>
                    <th className="text-left py-3 px-4">Used For</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["ElGamal (exponential)", "NIST SP 800-186", "Ballot encryption â€” (Î±, Î²) ciphertext pairs per selection"],
                    ["Homomorphic multiplication", "ElGamal property", "Tally: âˆÎ±_i mod p, âˆÎ²_i mod p â€” no decryption needed"],
                    ["Schnorr OR-proof", "IETF RFC 8235", "Proves each ballot selection âˆˆ {0,1} without revealing m"],
                    ["Chaum-Pedersen proof", "Chaum-Pedersen 1992", "Proves guardian applied correct key during decryption"],
                    ["Lagrange interpolation", "Shamir Secret Sharing", "Compensated decryption for absent guardians"],
                    ["Benaloh challenge", "Benaloh 2006", "Cast-or-spoil audit â€” voter can challenge encryption"],
                    ["ML-KEM-1024", "NIST FIPS 203", "Post-quantum KEM wrapping guardian ElGamal private keys"],
                    ["AES-256-CBC", "FIPS 197 / NIST", "Symmetric encryption of private key material"],
                    ["Scrypt (N=65536)", "RFC 7914", "Key derivation function for AES key from guardian password"],
                    ["HMAC-SHA256", "RFC 2104", "Integrity check on guardian credential.json files"],
                    ["BCrypt (strength=12)", "IETF", "Password hashing (admin/guardian account passwords)"],
                    ["JWT (HMAC-SHA256)", "RFC 7519", "Session tokens â€” 7-day expiry, HttpOnly cookie"],
                    ["Java SecureRandom", "CSPRNG", "OTP generation, ballot shuffle, key ceremony nonces"],
                    ["SHA-256", "FIPS 180-4", "Ballot tracking code (hash of all ciphertext pairs)"],
                    ["PKCS#7 padding", "RFC 5652", "Ballot request body padding to prevent traffic analysis"],
                  ].map(([a, s, u]) => (
                    <tr key={a} className="border-b border-gray-100 even:bg-gray-50 text-sm">
                      <td className="py-2.5 px-4 font-semibold text-gray-900">{a}</td>
                      <td className="py-2.5 px-4 text-blue-700 font-mono text-xs">{s}</td>
                      <td className="py-2.5 px-4 text-gray-600">{u}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Explore links */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Link to="/security">
                <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5 hover:border-purple-400 transition cursor-pointer">
                  <div className="font-bold text-purple-800 mb-1">ðŸ” Security Deep Dive â†’</div>
                  <p className="text-sm text-gray-600">Full mathematical proofs, pseudocode for ML-KEM-1024 flow, ZK proof formulas, and Benaloh protocol steps</p>
                </div>
              </Link>
              <Link to="/architecture">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 hover:border-blue-400 transition cursor-pointer">
                  <div className="font-bold text-blue-800 mb-1">ðŸ— Architecture Details â†’</div>
                  <p className="text-sm text-gray-600">Service map, Docker network topology, 4-phase data flow, RabbitMQ queue configs, Redis key patterns</p>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* PROJECT */}
        {tab === "team" && (
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Project Context</h2>
              <p className="text-gray-600">AmarVote was built as a comprehensive demonstration of end-to-end verifiable voting using open-source cryptographic standards. The implementation follows the ElectionGuard 2.x specification published by Microsoft Research.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-gray-200 p-6">
                <h3 className="font-bold text-gray-900 mb-3">ðŸ—‚ Repository Structure</h3>
                <div className="font-mono text-xs text-gray-700 space-y-1 bg-gray-50 rounded-xl p-4">
                  <div><span className="text-blue-600">frontend/</span> â€” React 19.1 + Vite SPA</div>
                  <div><span className="text-green-600">backend/</span> â€” Spring Boot 3.5 + Java 21</div>
                  <div><span className="text-purple-600">Microservice/</span> â€” EG Fast API + Worker</div>
                  <div><span className="text-teal-600">rag-service/</span> â€” LangChain + ChromaDB</div>
                  <div><span className="text-red-600">Database/</span> â€” SQL init, cleanup, diagnostics</div>
                  <div><span className="text-gray-600">prometheus/</span> â€” Metrics scraping config</div>
                  <div><span className="text-gray-500">docker-compose.yml</span> â€” Dev configuration</div>
                  <div><span className="text-gray-500">docker-compose.prod.yml</span> â€” Production config</div>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 p-6">
                <h3 className="font-bold text-gray-900 mb-3">ðŸ“‹ License & Compliance</h3>
                <div className="space-y-3">
                  <div className="rounded-xl bg-green-50 border border-green-200 p-3">
                    <div className="font-semibold text-green-800 text-sm">AmarVote</div>
                    <div className="text-xs text-gray-600">MIT License â€” free to use, modify, and distribute</div>
                  </div>
                  <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
                    <div className="font-semibold text-blue-800 text-sm">ElectionGuard SDK</div>
                    <div className="text-xs text-gray-600">MIT License (Microsoft) â€” open-source cryptographic library</div>
                  </div>
                  <div className="rounded-xl bg-purple-50 border border-purple-200 p-3">
                    <div className="font-semibold text-purple-800 text-sm">NIST FIPS 203 / ML-KEM-1024</div>
                    <div className="text-xs text-gray-600">CRYSTALS-Kyber â€” standardized post-quantum KEM algorithm</div>
                  </div>
                  <div className="rounded-xl bg-orange-50 border border-orange-200 p-3">
                    <div className="font-semibold text-orange-800 text-sm">Spring Boot / Java 21</div>
                    <div className="text-xs text-gray-600">Apache 2.0 + Oracle JDK license</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Video demos */}
            <div>
              <h3 className="font-bold text-gray-900 mb-3 text-lg">ðŸŽ¥ Demo Videos</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <a href="https://youtu.be/ixsvvl_7qVo" target="_blank" rel="noreferrer"
                  className="block rounded-2xl border border-gray-200 bg-gray-50 p-5 hover:border-blue-300 transition">
                  <div className="font-bold text-gray-900">Demo 1 â€” Full Election Walkthrough</div>
                  <div className="text-xs text-blue-600 mt-1">youtu.be/ixsvvl_7qVo</div>
                  <p className="text-sm text-gray-600 mt-2">Admin election creation, voter ballot casting, Benaloh challenge, decryption phase, and results animation.</p>
                </a>
                <a href="https://youtu.be/t8VOLdYIV40" target="_blank" rel="noreferrer"
                  className="block rounded-2xl border border-gray-200 bg-gray-50 p-5 hover:border-blue-300 transition">
                  <div className="font-bold text-gray-900">Demo 2 â€” Guardian Decryption</div>
                  <div className="text-xs text-blue-600 mt-1">youtu.be/t8VOLdYIV40</div>
                  <p className="text-sm text-gray-600 mt-2">Guardian credential submission, ML-KEM-1024 decryption flow, RabbitMQ worker processing, Lagrange combination, and result reveal.</p>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-12 bg-gradient-to-r from-gray-900 to-blue-950 rounded-2xl p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Explore the full platform</h2>
              <p className="text-gray-400 text-sm">Every section of AmarVote is open and auditable â€” from source code to cryptographic proofs.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/architecture">
                <button className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition text-sm">Architecture â†’</button>
              </Link>
              <Link to="/security">
                <button className="px-5 py-2.5 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition text-sm">Security â†’</button>
              </Link>
              <Link to="/how-it-works">
                <button className="px-5 py-2.5 border border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition text-sm">How It Works â†’</button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default About;

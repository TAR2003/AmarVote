import React, { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "./Layout";
import MarketingHero, { MarketingTabs } from "../components/MarketingHero";

const TRow = ({ label, value, sub }) => (
  <tr className="border-b border-ink/10 even:bg-frost">
    <td className="py-2.5 px-4 text-sm font-medium text-dusk whitespace-nowrap">{label}</td>
    <td className="py-2.5 px-4 text-sm text-ink font-semibold">{value}</td>
    {sub && <td className="py-2.5 px-4 text-xs text-dusk">{sub}</td>}
  </tr>
);

const ServiceCard = ({ icon, name, color, tags, description }) => {
  const colors = {
    blue: "border-brand/20 bg-glacier",
    green: "border-aurora/30 bg-sage-soft",
    orange: "border-ceremonial/40 bg-ceremonial-soft",
    teal: "border-aurora/30 bg-sage-soft",
    indigo: "border-brand/25 bg-glacier",
    red: "border-ember/30 bg-ember-soft",
    gray: "border-ink/10 bg-frost",
  };
  const tagColor = {
    blue: "bg-glacier text-brand-dark",
    green: "bg-sage-soft text-sage",
    orange: "bg-ceremonial-soft text-ink",
    teal: "bg-sage-soft text-aurora-muted",
    indigo: "bg-glacier text-ink",
    red: "bg-ember-soft text-ember",
    gray: "bg-frost text-dusk",
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[color]}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="font-display font-bold text-deep">{name}</span>
      </div>
      <p className="text-sm text-dusk mb-3">{description}</p>
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
      <MarketingHero
        kicker="About"
        title="About AmarVote"
        subtitle="Production-grade open-source e-voting on ElectionGuard cryptography, post-quantum key protection, and a resilient microservices core."
      >
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="https://youtu.be/ixsvvl_7qVo" target="_blank" rel="noreferrer" className="btn-brand text-sm">
            Platform demo
          </a>
          <a href="https://youtu.be/t8VOLdYIV40" target="_blank" rel="noreferrer" className="btn-ghost-light text-sm">
            Infrastructure demo
          </a>
          <Link to="/architecture" className="btn-ghost-light text-sm">
            Architecture
          </Link>
          <Link to="/security" className="btn-ghost-light text-sm">
            Security
          </Link>
        </div>
      </MarketingHero>

      <MarketingTabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "stack", label: "Tech Stack" },
          { id: "services", label: "Services" },
          { id: "crypto", label: "Cryptography" },
          { id: "team", label: "Project" },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="marketing-page max-w-6xl mx-auto px-4 py-12 sm:py-16 page-enter">

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="space-y-10">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="font-display text-2xl font-bold text-ink mb-3">What is AmarVote?</h2>
              <p className="text-dusk leading-relaxed">
                AmarVote is a fully self-hosted, end-to-end verifiable e-voting platform. Every ballot is encrypted by
                ElectionGuard&apos;s ElGamal scheme under the election&apos;s joint public key before it is recorded as a cast
                ballot. Homomorphic tallying accumulates encrypted votes without decrypting individual ballots, and a threshold
                of k-of-n guardians jointly decrypts using Lagrange interpolation. Zero-knowledge Schnorr and Chaum-Pedersen
                proofs are published alongside every result so any independent party can audit the election.
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
                <div key={v} className="rounded-2xl border border-ink/10 bg-paper p-5 text-center shadow-soft">
                  <div className="font-display text-2xl font-extrabold text-ink">{v}</div>
                  <div className="text-dusk text-sm mt-1">{l}</div>
                </div>
              ))}
            </div>

            {/* Roles */}
            <div>
              <h2 className="text-xl font-bold text-ink mb-4">Three Participant Roles</h2>
              <div className="grid md:grid-cols-3 gap-5">
                <div className="rounded-2xl border border-brand/20 bg-glacier p-5">
                  <div className="font-display font-bold text-ink mb-2 text-lg">Voter</div>
                  <ul className="text-sm text-dusk space-y-1">
                    <li>→ OTP login (email, no password)</li>
                    <li>→ Browse eligible elections</li>
                    <li>→ Cast encrypted ballot or challenge (Benaloh)</li>
                    <li>→ Verify ballot inclusion via tracking code</li>
                    <li>→ View animated results after decryption</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-brand/25 bg-glacier p-5">
                  <div className="font-display font-bold text-ink mb-2 text-lg">Guardian</div>
                  <ul className="text-sm text-dusk space-y-1">
                    <li>→ Receives ML-KEM-1024 encrypted credential.json</li>
                    <li>→ Holds ElGamal private key share s_i</li>
                    <li>→ Submits credentials for decryption phase</li>
                    <li>→ Minimum quorum k must participate</li>
                    <li>→ Absent guardians covered by Lagrange compensation</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-ceremonial/40 bg-ceremonial-soft p-5">
                  <div className="font-display font-bold text-ink mb-2 text-lg">Admin</div>
                  <ul className="text-sm text-dusk space-y-1">
                    <li>→ Create elections with guardian parameters</li>
                    <li>→ Manage voter eligibility lists</li>
                    <li>→ Monitor RabbitMQ + Redis via dashboard</li>
                    <li>→ Initiate tally and guardian prompts</li>
                    <li>→ Export results PDF (jsPDF + autotable)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Public pages */}
            <div className="bg-frost rounded-2xl border border-ink/10 p-6">
              <h2 className="text-lg font-bold text-ink mb-3">Public Pages (no login required)</h2>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  ["/", "Home", "Platform overview, architecture, RabbitMQ, roles, video demos"],
                  ["/features", "Features", "6-tab: Cryptography, Architecture, Security, Election, Monitoring, Optional"],
                  ["/how-it-works", "How It Works", "6-phase step-by-step: Auth → Setup → Casting → Tally → Decrypt → Verify"],
                  ["/architecture", "Architecture", "6-tab: Services, Network, DataFlow, RabbitMQ, Redis"],
                  ["/security", "Security", "7-tab: ElGamal, ML-KEM, ZK Proofs, Benaloh, Auth, Transport"],
                  ["/about", "About", "This page"],
                ].map(([path, name, desc]) => (
                  <Link key={path} to={path} className="block rounded-xl border border-ink/10 bg-paper p-4 hover:border-brand/30 transition">
                    <div className="font-bold text-ink text-sm">{name}</div>
                    <div className="text-xs text-brand font-mono mb-1">{path}</div>
                    <div className="text-xs text-dusk">{desc}</div>
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
              <h2 className="text-xl font-bold text-ink mb-4">Complete Technology Stack</h2>
              <div className="overflow-x-auto rounded-2xl border border-ink/10">
                <table className="w-full">
                  <thead className="bg-brand-dark text-paper text-sm">
                    <tr>
                      <th className="text-left py-3 px-4">Library / Tool</th>
                      <th className="text-left py-3 px-4">Version</th>
                      <th className="text-left py-3 px-4">Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-glacier"><td colSpan={3} className="px-4 py-2 text-xs font-bold text-brand-dark uppercase tracking-wider">Frontend</td></tr>
                    <TRow label="React" value="19.1.0" sub="UI framework with hooks and reactive rendering" />
                    <TRow label="Vite" value="6.3.5" sub="Build tool + dev server (HMR)" />
                    <TRow label="Tailwind CSS" value="3.4.17" sub="Utility-first CSS framework" />
                    <TRow label="React Router" value="7.6.2" sub="Client-side routing (SPA)" />
                    <TRow label="Recharts" value="latest" sub="Animated election results chart" />
                    <TRow label="Framer Motion" value="latest" sub="Results animation and page transitions" />
                    <TRow label="jsPDF + autotable" value="latest" sub="PDF export for election results" />
                    <TRow label="FingerprintJS BotD" value="1.9.1" sub="Bot detection before ballot submission" />
                    <TRow label="Cloudinary SDK" value="1.38.0" sub="Candidate & party image management" />

                    <tr className="bg-sage-soft"><td colSpan={3} className="px-4 py-2 text-xs font-bold text-sage uppercase tracking-wider">Backend (Spring Boot)</td></tr>
                    <TRow label="Java" value="21 (LTS)" sub="Primary backend language" />
                    <TRow label="Spring Boot" value="3.5.0" sub="Application framework + REST API" />
                    <TRow label="Spring Security" value="6.x" sub="JWT auth, RBAC, CSRF protection" />
                    <TRow label="JJWT" value="9.x" sub="JWT generation and validation (HMAC-SHA256)" />
                    <TRow label="PostgreSQL driver" value="42.7" sub="JDBC driver for Postgres 15" />
                    <TRow label="Spring Data JPA" value="3.5" sub="ORM + repository layer (Hibernate)" />
                    <TRow label="RabbitMQ AMQP" value="3.13" sub="Async message broker for election jobs" />
                    <TRow label="Spring Data Redis" value="3.x" sub="Redis client (Lettuce) — keys, counters, locks" />
                    <TRow label="Bouncy Castle" value="1.78" sub="ML-KEM-1024, AES-256-CBC, Scrypt, HMAC-SHA256" />
                    <TRow label="Spring Mail" value="3.x" sub="OTP + credential delivery via Gmail SMTP" />
                    <TRow label="msgpack" value="1.1" sub="Compact binary serialization for ballot blobs" />

                    <tr className="bg-glacier"><td colSpan={3} className="px-4 py-2 text-xs font-bold text-brand-dark uppercase tracking-wider">ElectionGuard Microservice (Python)</td></tr>
                    <TRow label="ElectionGuard" value="2.x" sub="Core cryptographic library (MIT, by Microsoft)" />
                    <TRow label="FastAPI" value="0.115.x" sub="Async HTTP API for EG endpoints" />
                    <TRow label="Celery" value="5.x" sub="Distributed task worker (EG Worker)" />
                    <TRow label="pika" value="1.3.x" sub="RabbitMQ AMQP 0.9 client for Python workers" />
                    <TRow label="msgpack-python" value="1.1" sub="Ballot blob deserialization in workers" />

                    <tr className="bg-ceremonial-soft"><td colSpan={3} className="px-4 py-2 text-xs font-bold text-ink uppercase tracking-wider">Infrastructure</td></tr>
                    <TRow label="PostgreSQL" value="15" sub="Primary relational DB — 14-table schema" />
                    <TRow label="Redis" value="7 Alpine" sub="Guardian key cache (6h TTL), atomic counters, SET NX locks" />
                    <TRow label="RabbitMQ" value="3.13" sub="4 durable queues, prefetch=1, management UI on :15672" />
                    <TRow label="Nginx" value="Alpine" sub="Reverse proxy + TLS termination; routes /api/* and /ws/*" />
                    <TRow label="Docker Compose" value="3.8" sub="Container orchestration (prod + dev configs)" />
                    <TRow label="Prometheus" value="latest" sub="Metrics scraping (optional monitoring)" />
                    <TRow label="Grafana" value="latest" sub="Dashboard visualization (optional monitoring)" />

                    <tr className="bg-sage-soft"><td colSpan={3} className="px-4 py-2 text-xs font-bold text-aurora-muted uppercase tracking-wider">Optional Services</td></tr>
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
            <h2 className="text-xl font-bold text-ink mb-2">Microservices Architecture</h2>
            <p className="text-dusk text-sm mb-6">All services run as isolated Docker containers on a 172.20.0.0/24 overlay network with static IPs.</p>

            <div className="grid md:grid-cols-2 gap-5">
              <ServiceCard icon="🌐" name="React Frontend" color="blue"
                tags={["172.20.0.40", "Vite dev server / Nginx prod"]}
                description="React 19.1 + Vite 6 SPA. Handles voting UI, bot detection, eligibility, animated results, and PDF export. Ballot ElGamal encryption runs on the ElectionGuard service via Spring Boot." />
              <ServiceCard icon="☕" name="Spring Boot Backend" color="green"
                tags={["172.20.0.30", "Port 8080", "Java 21", "REST + RabbitMQ producer"]}
                description="Core orchestration layer. Manages authentication (OTP + JWT), election lifecycle, guardian credential processing, ballot storage, and RabbitMQ job publishing with fair round-robin scheduler." />
              <ServiceCard icon="⚡" name="EG Fast API" color="blue"
                tags={["172.20.0.10", "Port 5000", "FastAPI", "Python 3.12"]}
                description="Synchronous ElectionGuard endpoints: /ceremony/setup, /ballot/encrypt, /ballot/challenge, and ZK proof generation. Handles key ceremony and per-voter encryption requests." />
              <ServiceCard icon="⚙️" name="EG Worker" color="orange"
                tags={["172.20.0.11", "Port 5001", "Celery", "4 consumers"]}
                description="Async RabbitMQ consumer. Processes tally.creation, partial.decryption, compensated.decryption, and combine.decryption queues. Each worker handles 1 chunk at a time (prefetch=1)." />
              <ServiceCard icon="🗃️" name="PostgreSQL 15" color="teal"
                tags={["172.20.0.20", "Port 5432", "14-table schema"]}
                description="Primary persistent store. Tables: users, elections, ballots, encrypted_tally, election_result, partial_decryption, compensated_decryption, guardian_keys, otp, election_jobs, audit_records, voting_sessions, voter_eligibility, candidates." />
              <ServiceCard icon="⚡" name="Redis 7" color="indigo"
                tags={["172.20.0.70", "Port 6379", "Replica: 172.20.0.75"]}
                description="Three use cases: guardian:{id}:key (SET, 6h TTL), tally_complete:{electionId} (INCR atomic counter), lock:chunk:{id}:{guardianId} (SET NX distributed lock). Read replica for high availability." />
              <ServiceCard icon="🐇" name="RabbitMQ 3.13" color="red"
                tags={["172.20.0.60", ":5672 AMQP", ":15672 Mgmt"]}
                description="Message broker with 4 durable queues: tally.creation, partial.decryption, compensated.decryption, combine.decryption. prefetch=1 ensures fair load across 4 concurrent consumers. Dead letter exchange configured for failed jobs." />
              <ServiceCard icon="🔀" name="Nginx Reverse Proxy" color="gray"
                tags={["172.20.0.80", "Port 80/443"]}
                description="TLS termination + request routing. /api/* → Spring Boot :8080. /ws/* → WebSocket connections. /* → React app. Upstream keepalive 32. Also serves static files in production." />
            </div>

            {/* Network table */}
            <div>
              <h3 className="text-lg font-bold text-ink mb-3">Static IP Assignment (172.20.0.0/24)</h3>
              <div className="overflow-x-auto rounded-2xl border border-ink/10">
                <table className="w-full text-sm">
                  <thead className="bg-brand-dark text-paper">
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
                      <tr key={ip} className="border-b border-ink/10 even:bg-frost">
                        <td className="py-2 px-4 font-mono text-xs text-brand-dark">{ip}</td>
                        <td className="py-2 px-4">{name}</td>
                        <td className="py-2 px-4 font-mono text-dusk">{port}</td>
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
            <h2 className="text-xl font-bold text-ink mb-2">Cryptographic Design</h2>

            <div className="overflow-x-auto rounded-2xl border border-ink/10">
              <table className="w-full">
                <thead className="bg-brand-dark text-paper text-sm">
                  <tr>
                    <th className="text-left py-3 px-4">Algorithm</th>
                    <th className="text-left py-3 px-4">Standard</th>
                    <th className="text-left py-3 px-4">Used For</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["ElGamal (exponential)", "NIST SP 800-186", "Ballot encryption — (α, β) ciphertext pairs per selection"],
                    ["Homomorphic multiplication", "ElGamal property", "Tally: ∏α_i mod p, ∏β_i mod p — no decryption needed"],
                    ["Schnorr OR-proof", "IETF RFC 8235", "Proves each ballot selection ∈ {0,1} without revealing m"],
                    ["Chaum-Pedersen proof", "Chaum-Pedersen 1992", "Proves guardian applied correct key during decryption"],
                    ["Lagrange interpolation", "Shamir Secret Sharing", "Compensated decryption for absent guardians"],
                    ["Benaloh challenge", "Benaloh 2006", "Cast-or-spoil audit — voter can challenge encryption"],
                    ["ML-KEM-1024", "NIST FIPS 203", "Post-quantum KEM wrapping guardian ElGamal private keys"],
                    ["AES-256-CBC", "FIPS 197 / NIST", "Symmetric encryption of private key material"],
                    ["Scrypt (N=65536)", "RFC 7914", "Key derivation function for AES key from guardian password"],
                    ["HMAC-SHA256", "RFC 2104", "Integrity check on guardian credential.json files"],
                    ["BCrypt (strength=12)", "IETF", "Password hashing (admin/guardian account passwords)"],
                    ["JWT (HMAC-SHA256)", "RFC 7519", "Session tokens — 7-day expiry, HttpOnly cookie"],
                    ["Java SecureRandom", "CSPRNG", "OTP generation, ballot shuffle, key ceremony nonces"],
                    ["SHA-256", "FIPS 180-4", "Ballot tracking code (hash of all ciphertext pairs)"],
                    ["PKCS#7 padding", "RFC 5652", "Ballot request body padding to prevent traffic analysis"],
                  ].map(([a, s, u]) => (
                    <tr key={a} className="border-b border-ink/10 even:bg-frost text-sm">
                      <td className="py-2.5 px-4 font-semibold text-ink">{a}</td>
                      <td className="py-2.5 px-4 text-brand-dark font-mono text-xs">{s}</td>
                      <td className="py-2.5 px-4 text-dusk">{u}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Explore links */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Link to="/security">
                <div className="rounded-2xl border border-brand/25 bg-glacier p-5 hover:border-brand transition cursor-pointer">
                  <div className="font-display font-bold text-ink mb-1">Security Deep Dive →</div>
                  <p className="text-sm text-dusk">Full mathematical proofs, pseudocode for ML-KEM-1024 flow, ZK proof formulas, and Benaloh protocol steps</p>
                </div>
              </Link>
              <Link to="/architecture">
                <div className="rounded-2xl border border-brand/20 bg-glacier p-5 hover:border-brand transition cursor-pointer">
                  <div className="font-display font-bold text-ink mb-1">Architecture Details →</div>
                  <p className="text-sm text-dusk">Service map, Docker network topology, 4-phase data flow, RabbitMQ queue configs, Redis key patterns</p>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* PROJECT */}
        {tab === "team" && (
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="font-display text-2xl font-bold text-ink mb-3">Project Context</h2>
              <p className="text-dusk">AmarVote was built as a comprehensive demonstration of end-to-end verifiable voting using open-source cryptographic standards. The implementation follows the ElectionGuard 2.x specification published by Microsoft Research.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-ink/10 p-6">
                <h3 className="font-display font-bold text-ink mb-3">Repository Structure</h3>
                <div className="font-mono text-xs text-dusk space-y-1 bg-frost rounded-xl p-4">
                  <div><span className="text-brand">frontend/</span> — React 19.1 + Vite SPA</div>
                  <div><span className="text-sage">backend/</span> — Spring Boot 3.5 + Java 21</div>
                  <div><span className="text-brand-dark">Microservice/</span> — EG Fast API + Worker</div>
                  <div><span className="text-aurora-muted">rag-service/</span> — LangChain + ChromaDB</div>
                  <div><span className="text-ember">Database/</span> — SQL init, cleanup, diagnostics</div>
                  <div><span className="text-dusk">prometheus/</span> — Metrics scraping config</div>
                  <div><span className="text-dusk">docker-compose.yml</span> — Dev configuration</div>
                  <div><span className="text-dusk">docker-compose.prod.yml</span> — Production config</div>
                </div>
              </div>
              <div className="rounded-2xl border border-ink/10 p-6">
                <h3 className="font-display font-bold text-ink mb-3">License & Compliance</h3>
                <div className="space-y-3">
                  <div className="rounded-xl bg-sage-soft border border-aurora/30 p-3">
                    <div className="font-semibold text-aurora-muted text-sm">AmarVote</div>
                    <div className="text-xs text-dusk">MIT License — free to use, modify, and distribute</div>
                  </div>
                  <div className="rounded-xl bg-glacier border border-brand/20 p-3">
                    <div className="font-semibold text-ink text-sm">ElectionGuard SDK</div>
                    <div className="text-xs text-dusk">MIT License (Microsoft) — open-source cryptographic library</div>
                  </div>
                  <div className="rounded-xl bg-glacier border border-brand/25 p-3">
                    <div className="font-semibold text-ink text-sm">NIST FIPS 203 / ML-KEM-1024</div>
                    <div className="text-xs text-dusk">CRYSTALS-Kyber — standardized post-quantum KEM algorithm</div>
                  </div>
                  <div className="rounded-xl bg-ceremonial-soft border border-ceremonial/40 p-3">
                    <div className="font-semibold text-ink text-sm">Spring Boot / Java 21</div>
                    <div className="text-xs text-dusk">Apache 2.0 + Oracle JDK license</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Video demos */}
            <div>
              <h3 className="font-display font-bold text-ink mb-3 text-lg">Demo Videos</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <a href="https://youtu.be/ixsvvl_7qVo" target="_blank" rel="noreferrer"
                  className="block rounded-2xl border border-ink/10 bg-frost p-5 hover:border-brand/30 transition">
                  <div className="font-bold text-ink">Demo 1 — Full Election Walkthrough</div>
                  <div className="text-xs text-brand mt-1">youtu.be/ixsvvl_7qVo</div>
                  <p className="text-sm text-dusk mt-2">Admin election creation, voter ballot casting, Benaloh challenge, decryption phase, and results animation.</p>
                </a>
                <a href="https://youtu.be/t8VOLdYIV40" target="_blank" rel="noreferrer"
                  className="block rounded-2xl border border-ink/10 bg-frost p-5 hover:border-brand/30 transition">
                  <div className="font-bold text-ink">Demo 2 — Guardian Decryption</div>
                  <div className="text-xs text-brand mt-1">youtu.be/t8VOLdYIV40</div>
                  <p className="text-sm text-dusk mt-2">Guardian credential submission, ML-KEM-1024 decryption flow, RabbitMQ worker processing, Lagrange combination, and result reveal.</p>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-12 bg-gradient-to-r from-deep to-deep-soft rounded-2xl p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-xl font-bold text-paper mb-2">Explore the full platform</h2>
              <p className="text-dusk text-sm">Every section of AmarVote is open and auditable — from source code to cryptographic proofs.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/architecture">
                <button className="px-5 py-2.5 bg-brand-dark text-paper font-semibold rounded-xl hover:bg-brand-dark transition text-sm">Architecture →</button>
              </Link>
              <Link to="/security">
                <button className="px-5 py-2.5 bg-ink text-paper font-semibold rounded-xl hover:bg-brand-dark transition text-sm">Security →</button>
              </Link>
              <Link to="/how-it-works">
                <button className="px-5 py-2.5 border border-white/30 text-paper font-semibold rounded-xl hover:bg-paper/10 transition text-sm">How It Works →</button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default About;

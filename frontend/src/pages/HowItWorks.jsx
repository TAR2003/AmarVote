import React, { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "./Layout";

const Step = ({ n, title, actor, color, children }) => {
  const bg = { blue: "bg-blue-600", green: "bg-green-600", purple: "bg-purple-600", orange: "bg-orange-600", indigo: "bg-indigo-600", red: "bg-red-600", teal: "bg-teal-600" };
  const border = { blue: "border-blue-200 bg-blue-50", green: "border-green-200 bg-green-50", purple: "border-purple-200 bg-purple-50", orange: "border-orange-200 bg-orange-50", indigo: "border-indigo-200 bg-indigo-50", red: "border-red-200 bg-red-50", teal: "border-teal-200 bg-teal-50" };
  const actorColor = { blue: "text-blue-700 bg-blue-100", green: "text-green-700 bg-green-100", purple: "text-purple-700 bg-purple-100", orange: "text-orange-700 bg-orange-100", indigo: "text-indigo-700 bg-indigo-100", red: "text-red-700 bg-red-100", teal: "text-teal-700 bg-teal-100" };
  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-10 h-10 rounded-full ${bg[color]} text-white font-extrabold text-lg flex items-center justify-center shadow-md`}>{n}</div>
        <div className="w-px flex-1 bg-gray-200 mt-2" />
      </div>
      <div className={`flex-1 rounded-2xl border p-5 mb-4 ${border[color]}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${actorColor[color]}`}>{actor}</span>
        </div>
        {children}
      </div>
    </div>
  );
};

const SubPoint = ({ children }) => (
  <li className="flex items-start text-sm text-gray-700 mt-1">
    <span className="mr-2 text-gray-400 flex-shrink-0">→</span>{children}
  </li>
);

const CodeSnip = ({ label, code }) => (
  <div className="bg-gray-900 rounded-xl p-4 mt-3 font-mono text-xs text-gray-300">
    {label && <div className="text-green-400 mb-2">// {label}</div>}
    <pre className="whitespace-pre-wrap leading-relaxed overflow-x-auto">{code}</pre>
  </div>
);

const HowItWorks = () => {
  const [activePhase, setActivePhase] = useState("auth");

  return (
    <Layout>
      {/* Hero */}
      <div className="bg-gradient-to-br from-gray-900 to-blue-950 py-16 px-4 text-center">
        <div className="inline-flex items-center px-4 py-2 bg-blue-500/10 border border-blue-400/30 rounded-full text-blue-300 text-sm font-medium mb-6">
          <span className="mr-2">🔄</span>Complete Technical Workflow
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">How AmarVote Works</h1>
        <p className="text-blue-200/80 text-lg max-w-2xl mx-auto">
          A deep-dive walkthrough of every phase — from OTP authentication through cryptographic ballot casting, RabbitMQ processing, guardian threshold decryption, and end-to-end verification.
        </p>
      </div>

      {/* Phase tabs */}
      <div className="border-b border-gray-200 bg-white sticky top-16 z-20">
        <div className="max-w-6xl mx-auto px-4 flex overflow-x-auto">
          {[
            ["auth", "🪪 Authentication"],
            ["setup", "🔧 Election Setup"],
            ["voting", "🗳️ Ballot Casting"],
            ["tally", "🔢 Tallying"],
            ["decrypt", "🔓 Decryption"],
            ["verify", "✅ Verification"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActivePhase(id)}
              className={`px-4 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activePhase === id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">

        {/* ═══ AUTH ═══ */}
        {activePhase === "auth" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Phase 1 — Authentication</h2>
            <p className="text-gray-500 text-center mb-8">Passwordless OTP login creates a JWT session with role-based access</p>
            <div>
              <Step n="1" title="Email Entry" actor="Voter / Guardian / Admin" color="blue">
                <p className="text-sm text-gray-700 mb-2">User navigates to /otp-login and enters their email address. No password is required.</p>
                <ul className="space-y-0.5">
                  <SubPoint>React frontend sends POST /api/auth/request-otp with email</SubPoint>
                  <SubPoint>Spring Boot validates email format and checks user exists in DB</SubPoint>
                </ul>
              </Step>
              <Step n="2" title="OTP Generation & Email Delivery" actor="Spring Boot + Gmail SMTP" color="green">
                <p className="text-sm text-gray-700 mb-2">A one-time 6-digit code is generated and sent to the user's email inbox.</p>
                <ul className="space-y-0.5">
                  <SubPoint>Java SecureRandom generates a 6-digit integer (cryptographically random)</SubPoint>
                  <SubPoint>OTP stored in otp table with 5-minute TTL and single-use flag</SubPoint>
                  <SubPoint>Spring Mail sends email via Gmail SMTP with TLS (port 587)</SubPoint>
                </ul>
                <CodeSnip label="OTP stored in DB" code={`otp {
  id, user_email, code: "482916",
  created_at: 2024-01-01T10:00:00Z,
  expires_at: 2024-01-01T10:05:00Z,
  used: false
}`} />
              </Step>
              <Step n="3" title="OTP Validation & JWT Issuance" actor="Spring Boot" color="purple">
                <p className="text-sm text-gray-700 mb-2">User submits the OTP code. Backend validates it and issues a JWT session token.</p>
                <ul className="space-y-0.5">
                  <SubPoint>POST /api/auth/verify-otp with {"{email, code}"}</SubPoint>
                  <SubPoint>Backend checks: code matches, not expired, not already used</SubPoint>
                  <SubPoint>OTP marked used=true immediately (single-use enforcement)</SubPoint>
                  <SubPoint>JJWT generates JWT: sub=email, role=VOTER|GUARDIAN|ADMIN, exp=now+7days</SubPoint>
                  <SubPoint>JWT set as HttpOnly SameSite cookie (not accessible to JavaScript)</SubPoint>
                </ul>
                <CodeSnip label="JWT payload" code={`{
  "sub": "voter@example.com",
  "role": "VOTER",
  "iat": 1704067200,
  "exp": 1704672000    // +7 days
}`} />
              </Step>
              <Step n="4" title="Session & Role-based Access" actor="Spring Security" color="teal">
                <p className="text-sm text-gray-700 mb-2">Every subsequent request carries the JWT cookie. Spring Security validates it on each request.</p>
                <ul className="space-y-0.5">
                  <SubPoint>JwtAuthenticationFilter reads cookie → validates HMAC-SHA256 signature + expiry</SubPoint>
                  <SubPoint>Sets SecurityContext with user email + GrantedAuthority (role)</SubPoint>
                  <SubPoint>Spring Security @PreAuthorize / .hasRole() annotations enforce access</SubPoint>
                  <SubPoint>CSRF protection: Spring Security CSRF + SameSite cookie</SubPoint>
                </ul>
              </Step>
            </div>
          </div>
        )}

        {/* ═══ SETUP ═══ */}
        {activePhase === "setup" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Phase 2 — Election Setup & Key Ceremony</h2>
            <p className="text-gray-500 text-center mb-8">Admin creates election → guardians complete Round 1 and Round 2 ceremony tasks → admin activates election</p>
            <div>
              <Step n="1" title="Election Creation" actor="Admin" color="blue">
                <p className="text-sm text-gray-700 mb-2">Admin fills the election creation form in the React dashboard.</p>
                <ul className="space-y-0.5">
                  <SubPoint>Fields: name, description, start date, end date, candidate names + parties</SubPoint>
                  <SubPoint>Guardian count n (e.g. 5) and quorum threshold k (e.g. 3)</SubPoint>
                  <SubPoint>Eligibility: open / restricted / listed (by email list) / unlisted (private URL)</SubPoint>
                  <SubPoint>Images uploaded to Cloudinary via SDK 1.38.0 (candidates, party logos)</SubPoint>
                  <SubPoint>POST /api/create-election → election saved to DB (status = key_ceremony_pending)</SubPoint>
                </ul>
              </Step>
              <Step n="2" title="Guardian Round 1 + Round 2 Ceremony" actor="Guardian + Spring Boot + EG Fast API" color="green">
                <p className="text-sm text-gray-700 mb-2">Each guardian participates directly: generate own credentials, submit keypair payload, then generate and submit encrypted backup shares.</p>
                <ul className="space-y-0.5">
                  <SubPoint>Guardian UI calls /api/guardian/key-ceremony/generate/{"{electionId}"} for Round 1 credential generation</SubPoint>
                  <SubPoint>Round 1 submission: /api/guardian/key-ceremony/submit (public key + encrypted credential metadata path)</SubPoint>
                  <SubPoint>Round 2 opens only after all guardians finish Round 1</SubPoint>
                  <SubPoint>Round 2 generation: /api/guardian/key-ceremony/backup/generate/{"{electionId}"}</SubPoint>
                  <SubPoint>Round 2 submission: /api/guardian/key-ceremony/backup/submit</SubPoint>
                </ul>
                <CodeSnip label="Key ceremony response" code={`{
  "currentRound": "keypair_generation | backup_key_sharing",
  "submittedGuardians": 4,
  "submittedBackupGuardians": 3,
  "readyForActivation": false
}`} />
              </Step>
              <Step n="3" title="Admin Activation after Ceremony" actor="Admin + Spring Boot" color="purple">
                <p className="text-sm text-gray-700 mb-2">Admin activates the election only after all guardians have submitted required Round 1 and Round 2 data.</p>
                <ul className="space-y-0.5">
                  <SubPoint>Admin checks /api/admin/key-ceremony/status/{"{electionId}"}</SubPoint>
                  <SubPoint>Activation endpoint: /api/admin/key-ceremony/activate</SubPoint>
                  <SubPoint>Backend combines guardian public keys through ElectionGuard combine endpoint</SubPoint>
                  <SubPoint>Election receives joint public key and schedule, then moves to active lifecycle</SubPoint>
                </ul>
              </Step>
            </div>
          </div>
        )}

        {/* ═══ VOTING ═══ */}
        {activePhase === "voting" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Phase 3 — Ballot Casting</h2>
            <p className="text-gray-500 text-center mb-8">Bot detection → ballot encryption → optional Benaloh challenge → cast with traffic padding</p>
            <div>
              <Step n="1" title="Bot Detection" actor="React Frontend" color="red">
                <p className="text-sm text-gray-700 mb-2">Before showing the ballot, the frontend runs FingerprintJS Bot Detection.</p>
                <ul className="space-y-0.5">
                  <SubPoint>FingerprintJS BotD 1.9.1 library: analyzes browser signals, automation artifacts</SubPoint>
                  <SubPoint>Returns: {"{isBot: false, botKind: null}"} for legitimate users</SubPoint>
                  <SubPoint>isBot result + current timestamp saved in React state for inclusion in ballot request</SubPoint>
                  <SubPoint>Bot-detected browsers are blocked from the ballot UI entirely (redirect with 403)</SubPoint>
                </ul>
              </Step>
              <Step n="2" title="Candidate Selection & Encryption" actor="React + EG Fast API" color="blue">
                <p className="text-sm text-gray-700 mb-2">Voter selects a candidate → frontend immediately calls ElectionGuard to encrypt.</p>
                <ul className="space-y-0.5">
                  <SubPoint>POST to EG Fast API /ballot/encrypt with selection index + election_id</SubPoint>
                  <SubPoint>EG encrypts each selection: (α_i, β_i) = (g^ξ_i, g^m_i · K^ξ_i) mod p</SubPoint>
                  <SubPoint>Schnorr OR-proof generated: proves each selection ∈ {"{0, 1}"} without revealing m</SubPoint>
                  <SubPoint>SHA-256(all ciphertext pairs) → tracking_code returned to frontend</SubPoint>
                  <SubPoint>Encrypted ballot displayed to voter for review</SubPoint>
                </ul>
              </Step>
              <Step n="3" title="Optional: Benaloh Challenge" actor="Voter (optional)" color="orange">
                <p className="text-sm text-gray-700 mb-2">Voter can optionally challenge the encryption before deciding to cast.</p>
                <ul className="space-y-0.5">
                  <SubPoint>Voter clicks "Challenge" → POST /ballot/challenge with ballot_id</SubPoint>
                  <SubPoint>EG Fast API returns all nonces ξ_i in plaintext</SubPoint>
                  <SubPoint>Voter verifies: α_i == g^ξ_i mod p AND β_i == g^m_actual · K^ξ_i mod p</SubPoint>
                  <SubPoint>If correct: encryption was honest. Ballot is spoiled (publicly logged with nonces)</SubPoint>
                  <SubPoint>Voter must re-encrypt and cast a new ballot (spoiled ballots not counted)</SubPoint>
                  <SubPoint>If voter doesn't challenge: clicks "Cast" → proceeds to step 4</SubPoint>
                </ul>
              </Step>
              <Step n="4" title="Ballot Submission (PKCS#7 padded)" actor="React → Spring Boot" color="purple">
                <p className="text-sm text-gray-700 mb-2">Encrypted ballot submitted with traffic padding and server-side anti-fraud checks.</p>
                <ul className="space-y-0.5">
                  <SubPoint>React pads the ballot request body to a fixed size using PKCS#7 (RFC 5652)</SubPoint>
                  <SubPoint>POST /api/ballot/cast with: {"{encrypted_ballot, tracking_code, isBot, timestamp, schnorr_proofs}"}</SubPoint>
                  <SubPoint>Spring Boot validates: isBot == false, |now - timestamp| {"<"} 5 minutes</SubPoint>
                  <SubPoint>Validates Schnorr proofs (delegates to EG Fast API if needed)</SubPoint>
                  <SubPoint>Saves ballot to DB: encrypted blob (msgpack), tracking_code, voter_id, election_id, cast_at</SubPoint>
                  <SubPoint>Returns tracking_code to voter — save this for later verification</SubPoint>
                </ul>
              </Step>
            </div>
          </div>
        )}

        {/* ═══ TALLY ═══ */}
        {activePhase === "tally" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Phase 4 — Tally Creation (RabbitMQ)</h2>
            <p className="text-gray-500 text-center mb-8">Admin initiates tally → ballots chunked → RabbitMQ round-robin → workers homomorphically multiply</p>
            <div>
              <Step n="1" title="Admin Initiates Tally" actor="Admin" color="orange">
                <p className="text-sm text-gray-700 mb-2">After election closes, admin clicks "Initiate Tally" in the admin dashboard.</p>
                <ul className="space-y-0.5">
                  <SubPoint>POST /api/elections/{"{id}"}/initiate-tally</SubPoint>
                  <SubPoint>Spring Boot fetches all cast ballot ciphertexts from DB (msgpack blobs)</SubPoint>
                  <SubPoint>Election status → TALLY_IN_PROGRESS</SubPoint>
                </ul>
              </Step>
              <Step n="2" title="Ballot Shuffle & Chunking" actor="Spring Boot" color="blue">
                <p className="text-sm text-gray-700 mb-2">Ballots randomized to prevent linking position to voter, then split into manageable chunks.</p>
                <ul className="space-y-0.5">
                  <SubPoint>Java Collections.shuffle(ballots, SecureRandom) — cryptographically random ordering</SubPoint>
                  <SubPoint>Split into chunks of 200 ballots each (configurable)</SubPoint>
                  <SubPoint>Each chunk gets an election_job record: task_id, chunk_index, status=PENDING</SubPoint>
                  <SubPoint>200-ballot chunks prevent OutOfMemoryError for 10,000+ voter elections</SubPoint>
                </ul>
              </Step>
              <Step n="3" title="RabbitMQ Round-Robin Publication" actor="RoundRobinTaskScheduler" color="green">
                <p className="text-sm text-gray-700 mb-2">Chunks published to RabbitMQ with fair scheduling across concurrent elections.</p>
                <ul className="space-y-0.5">
                  <SubPoint>@Scheduled 100ms tick — dequeues PENDING chunks round-robin across ALL active elections</SubPoint>
                  <SubPoint>targetChunksPerCycle=8, maxQueuedChunks=1 per election per tick</SubPoint>
                  <SubPoint>Fair interleaving: Election A (500 chunks) does not starve Election B (50 chunks)</SubPoint>
                  <SubPoint>Each published chunk: PENDING → QUEUED in DB; sent to tally.creation.queue</SubPoint>
                </ul>
                <CodeSnip label="Round-robin example — 2 concurrent elections" code={`Tick 1:  E_A chunk_0 → QUEUED, E_B chunk_0 → QUEUED
Tick 2:  E_A chunk_1 → QUEUED, E_B chunk_1 → QUEUED
...
(not: E_A 0..499, then E_B 0..49)`} />
              </Step>
              <Step n="4" title="Worker: Homomorphic Tally" actor="EG Worker (4 concurrent consumers)" color="purple">
                <p className="text-sm text-gray-700 mb-2">Each worker takes one chunk and multiplies all encrypted ballots homomorphically.</p>
                <ul className="space-y-0.5">
                  <SubPoint>prefetch=1: each consumer gets 1 message at a time → no backlog on a single worker</SubPoint>
                  <SubPoint>Worker deserializes 200 ballot ciphertexts via msgpack</SubPoint>
                  <SubPoint>Homomorphic product: A_chunk = ∏α_i mod p, B_chunk = ∏β_i mod p (encrypted sum)</SubPoint>
                  <SubPoint>Saves encrypted tally chunk to DB (encrypted_tally table)</SubPoint>
                  <SubPoint>Redis INCR atomic counter tally_complete:{"{electionId}"}</SubPoint>
                  <SubPoint>First worker to reach count == total_chunks uses SET NX to trigger partial decryption phase</SubPoint>
                  <SubPoint>entityManager.clear() + System.gc() after chunk to prevent heap buildup</SubPoint>
                </ul>
              </Step>
            </div>
          </div>
        )}

        {/* ═══ DECRYPT ═══ */}
        {activePhase === "decrypt" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Phase 5 — Guardian Decryption</h2>
            <p className="text-gray-500 text-center mb-8">Guardians submit credentials → workers compute partial shares → Lagrange combine → final result</p>
            <div>
              <Step n="1" title="Guardian Credential Submission" actor="Guardian" color="purple">
                <p className="text-sm text-gray-700 mb-2">Guardian uploads their credential.json file via the React dashboard.</p>
                <ul className="space-y-0.5">
                  <SubPoint>Guardian logs in via OTP → navigates to Guardian Dashboard</SubPoint>
                  <SubPoint>Uploads credential.json received during election setup</SubPoint>
                  <SubPoint>POST /api/guardian/submit-key with encrypted credential file</SubPoint>
                  <SubPoint>Spring Boot verifies HMAC-SHA256 tag on the credential file</SubPoint>
                  <SubPoint>ML-KEM-1024 decapsulation: K_kem = sk_kem.decap(kem_ciphertext)</SubPoint>
                  <SubPoint>AES-256-CBC decrypt → msgpack decode → ElGamal private key s_i</SubPoint>
                  <SubPoint>SET guardian:{"{guardianId}"}:key s_i EX 21600 → Redis key expires in 6 hours</SubPoint>
                </ul>
              </Step>
              <Step n="2" title="Partial Decryption (per guardian × chunk)" actor="EG Worker" color="blue">
                <p className="text-sm text-gray-700 mb-2">Workers apply each guardian's private key to each tally chunk independently.</p>
                <ul className="space-y-0.5">
                  <SubPoint>Spring Boot publishes (guardians × total_chunks) messages to partial.decryption.queue</SubPoint>
                  <SubPoint>Worker reads: SET NX lock:chunk:{"{chunkId}"}:{"{guardianId}"} (prevents duplicate processing)</SubPoint>
                  <SubPoint>GET guardian:{"{guardianId}"}:key from Redis → ElGamal private key</SubPoint>
                  <SubPoint>Partial decryption: M_i = A_chunk^s_i mod p (applies guardian's secret key)</SubPoint>
                  <SubPoint>Chaum-Pedersen ZK proof generated: proves used correct key s_i</SubPoint>
                  <SubPoint>Partial share saved to partial_decryption table</SubPoint>
                  <SubPoint>INCR partial_complete:{"{electionId}"}; SET NX triggers combine when all done</SubPoint>
                </ul>
                <CodeSnip label="Partial decryption for guardian i, chunk c" code={`M_ic = A_c ^ s_i mod p
// A_c = homomorphic product A for chunk c
// s_i = guardian i's ElGamal secret key (from Redis)
// M_ic = partial decryption share for guardian i, chunk c`} />
              </Step>
              <Step n="3" title="Compensated Decryption (absent guardians)" actor="EG Worker" color="orange">
                <p className="text-sm text-gray-700 mb-2">If fewer than k guardians submit, present guardians cover absent ones via Lagrange interpolation.</p>
                <ul className="space-y-0.5">
                  <SubPoint>Backend detects missing guardian shares after partial.decryption.queue drains</SubPoint>
                  <SubPoint>For each absent guardian i: each present guardian j generates a compensated share</SubPoint>
                  <SubPoint>Uses absent guardian's polynomial backup (stored in DB from key ceremony)</SubPoint>
                  <SubPoint>M_comp = A_chunk ^ (f_j(i) · λ_j(S_i)) mod p (Lagrange-weighted reconstruction)</SubPoint>
                  <SubPoint>Compensated shares saved to compensated_decryption table</SubPoint>
                  <SubPoint>Minimum k present guardians required; below k → decryption impossible (by design)</SubPoint>
                </ul>
              </Step>
              <Step n="4" title="Combine: Final Tally Reconstruction" actor="EG Worker" color="green">
                <p className="text-sm text-gray-700 mb-2">All partial + compensated shares assembled to extract plaintext vote counts.</p>
                <ul className="space-y-0.5">
                  <SubPoint>Spring Boot publishes to combine.decryption.queue after all share phases complete</SubPoint>
                  <SubPoint>Worker assembles per-chunk shares from DB: M_c = ∏M_ic^(λ_i) mod p</SubPoint>
                  <SubPoint>Discrete log: vote_count = log_g(B_c · M_c^(-1) mod p) per candidate per chunk</SubPoint>
                  <SubPoint>Sums across all chunks → final total per candidate</SubPoint>
                  <SubPoint>Chaum-Pedersen proofs assembled per guardian per chunk into election_result</SubPoint>
                  <SubPoint>Election status → DECRYPTED; results + proofs saved to election_result table</SubPoint>
                </ul>
                <CodeSnip label="Final tally extraction" code={`// For each chunk c:
M_c = ∏ M_ic^(λ_i) mod p     // combine all shares
t_c = DLog_g(B_c / M_c mod p) // discrete log = vote count

// Total:
total_votes[candidate] = Σ t_c  // sum across all chunks`} />
              </Step>
            </div>
          </div>
        )}

        {/* ═══ VERIFY ═══ */}
        {activePhase === "verify" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Phase 6 — Results & End-to-End Verification</h2>
            <p className="text-gray-500 text-center mb-8">Animated results display and independent proof verification</p>
            <div>
              <Step n="1" title="Animated Results Display" actor="React Frontend" color="blue">
                <p className="text-sm text-gray-700 mb-2">Once DECRYPTED status is returned from the API, results are revealed with animations.</p>
                <ul className="space-y-0.5">
                  <SubPoint>Frontend polls /api/elections/{"{id}"}/status every 5s during decryption</SubPoint>
                  <SubPoint>Progress bar shows % of chunks completed (Redis counter / total_chunks × 100)</SubPoint>
                  <SubPoint>On DECRYPTED: Framer Motion animates bar charts + Recharts renders vote counts</SubPoint>
                  <SubPoint>Per-candidate: vote count + percentage share shown</SubPoint>
                  <SubPoint>Admin can export results PDF via jsPDF + autotable</SubPoint>
                </ul>
              </Step>
              <Step n="2" title="Ballot Inclusion Verification" actor="Voter" color="green">
                <p className="text-sm text-gray-700 mb-2">Voter verifies their specific ballot was included in the tally using their tracking code.</p>
                <ul className="space-y-0.5">
                  <SubPoint>Voter enters tracking code at /verify → GET /api/ballot/verify/{"{trackingCode}"}</SubPoint>
                  <SubPoint>Backend confirms: ballot with this SHA-256 code is in the ballot table with status=CAST</SubPoint>
                  <SubPoint>Frontend shows: "Your ballot was cast and included in the tally."</SubPoint>
                  <SubPoint>Tracking code is the SHA-256 hash of all ciphertext pairs — uniquely identifies the ballot</SubPoint>
                </ul>
              </Step>
              <Step n="3" title="Cryptographic Proof Download & Verification" actor="Auditor / Voter" color="purple">
                <p className="text-sm text-gray-700 mb-2">Any party can download and independently verify all cryptographic proofs.</p>
                <ul className="space-y-0.5">
                  <SubPoint>Download election_result JSON: contains vote counts + Chaum-Pedersen proofs per guardian per chunk</SubPoint>
                  <SubPoint>Verify: g^v · K_i^c == a AND A^v · M_ic^c == b (Chaum-Pedersen check for each share)</SubPoint>
                  <SubPoint>Verify: ballot Schnorr proofs — confirm each selection was 0 or 1</SubPoint>
                  <SubPoint>Re-tally: re-multiply all encrypted ballots and compare to stored encryted tally</SubPoint>
                  <SubPoint>Any standard ElectionGuard verifier binary (e.g. Microsoft's reference implementation) can validate</SubPoint>
                </ul>
                <CodeSnip label="Chaum-Pedersen proof verification" code={`// For each guardian i, chunk c:
g^v · K_i^challenge == commitment_a  // ✓?
A^v · M_ic^challenge == commitment_b // ✓?

// If both pass: guardian i used the correct key
// for chunk c. Decryption was honest.`} />
              </Step>
            </div>
          </div>
        )}

        {/* Phase navigation */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {[
            ["auth", "← Authentication", "blue"],
            ["setup", "Election Setup →", "green"],
            ["voting", "Ballot Casting →", "purple"],
            ["tally", "Tallying →", "orange"],
            ["decrypt", "Decryption →", "indigo"],
            ["verify", "Verification →", "teal"],
          ].map(([id, label, color]) => (
            activePhase !== id && (
              <button key={id} onClick={() => setActivePhase(id)}
                className={`px-4 py-2 text-sm font-medium rounded-xl border transition-colors ${
                  color === "blue" ? "border-blue-200 text-blue-700 hover:bg-blue-50" :
                  color === "green" ? "border-green-200 text-green-700 hover:bg-green-50" :
                  color === "purple" ? "border-purple-200 text-purple-700 hover:bg-purple-50" :
                  color === "orange" ? "border-orange-200 text-orange-700 hover:bg-orange-50" :
                  color === "indigo" ? "border-indigo-200 text-indigo-700 hover:bg-indigo-50" :
                  "border-teal-200 text-teal-700 hover:bg-teal-50"
                }`}>
                {label}
              </button>
            )
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-3">Ready to experience it yourself?</h2>
          <p className="text-blue-200 text-sm mb-5">Sign in with just your email address — no password needed.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/otp-login">
              <button className="px-6 py-3 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition">
                Get Started →
              </button>
            </Link>
            <Link to="/security">
              <button className="px-6 py-3 border border-white/40 text-white font-semibold rounded-xl hover:bg-white/10 transition">
                Security Details →
              </button>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};


export default HowItWorks;

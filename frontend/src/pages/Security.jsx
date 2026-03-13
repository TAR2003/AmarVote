import React, { useState } from "react";
import Layout from "./Layout";

const Security = () => {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <Layout>
      {/* ── Hero ─────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-purple-950 to-indigo-950 py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full text-purple-300 text-sm font-medium mb-6">
            <span className="mr-2">🔐</span>Security Deep Dive
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
            Cryptographic Security Architecture
          </h1>
          <p className="text-purple-200/80 text-lg max-w-3xl mx-auto">
            AmarVote implements defense-in-depth across every layer — from post-quantum key encapsulation to zero-knowledge proofs to bot detection — ensuring privacy, integrity, and end-to-end verifiability.
          </p>
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-white sticky top-16 z-20">
        <div className="max-w-6xl mx-auto px-4 flex overflow-x-auto">
          {[
            ["overview", "📋 Overview"],
            ["elgamal", "🔒 ElGamal E2E"],
            ["postquantum", "🛡️ Post-Quantum"],
            ["zkproofs", "✅ ZK Proofs"],
            ["benaloh", "🔍 Benaloh Challenge"],
            ["auth", "🪪 Auth & Access"],
            ["transport", "📦 Transport"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === id
                  ? "border-purple-600 text-purple-600"
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
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Security Layer Overview</h2>

            {/* Quick reference table */}
            <div className="bg-gray-900 rounded-2xl p-6 mb-8 overflow-x-auto">
              <h3 className="text-green-400 font-bold text-lg mb-4 font-mono">// Complete Cryptographic Specification</h3>
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2 pr-4">Component</th>
                    <th className="text-left py-2 pr-4">Algorithm / Scheme</th>
                    <th className="text-left py-2 pr-4">Standard</th>
                    <th className="text-left py-2">Purpose</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  {[
                    ["Vote Encryption", "ElGamal 4096-bit (ElectionGuard)", "ElectionGuard Spec 2.1", "End-to-end ballot privacy"],
                    ["Homomorphic Tally", "Multiplicative ElGamal", "ElectionGuard Spec 2.1", "Tally without decryption"],
                    ["Key Encapsulation", "ML-KEM-1024 (CRYSTALS-Kyber)", "NIST FIPS 203", "Post-quantum key wrapping"],
                    ["Symmetric Wrap", "AES-256-CBC", "NIST FIPS 197", "Guardian key encryption"],
                    ["Key Derivation", "Scrypt (N=2^16, r=8, p=1)", "RFC 7914", "Password-based key strengthening"],
                    ["Message Auth", "HMAC-SHA256", "FIPS 198-1", "Credential file integrity"],
                    ["ZK Proofs", "Chaum-Pedersen σ-protocol", "ElectionGuard Spec 2.1", "Decryption correctness proof"],
                    ["Ballot Validity", "Schnorr σ-protocol", "ElectionGuard Spec 2.1", "One-selection-per-contest proof"],
                    ["Session Auth", "JWT + HMAC-SHA256 / JJWT 0.12.6", "RFC 7519", "Stateless authentication"],
                    ["Password Hash", "BCrypt strength=12", "—", "User password storage"],
                    ["OTP", "6-digit integer, SecureRandom", "NIST SP 800-63B", "Passwordless auth token"],
                    ["Ballot Tracking", "SHA-256", "NIST FIPS 180-4", "Public bulletin board key"],
                    ["Ballot Padding", "PKCS#7 fixed-size", "RFC 5652", "Traffic-analysis resistance"],
                    ["Serialization", "msgpack binary", "MessagePack spec", "10–50× vs JSON, 4096-bit ints"],
                    ["Public audit records", "SHA-256 + signed payloads", "Internal verification profile", "Supplementary transparency metadata"],
                  ].map(([comp, algo, std, purpose]) => (
                    <tr key={comp} className="border-b border-gray-800 hover:bg-white/5">
                      <td className="py-2 pr-4 text-blue-300 font-semibold">{comp}</td>
                      <td className="py-2 pr-4 text-yellow-300">{algo}</td>
                      <td className="py-2 pr-4 text-gray-400">{std}</td>
                      <td className="py-2 text-gray-300">{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Defense in depth */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: "🔐", title: "Encryption at Rest", items: ["AWS/Neon TLS for cloud DB", "Ballot blobs stored as msgpack binary", "No plaintext votes ever in DB"], color: "purple" },
                { icon: "🔒", title: "Encryption in Transit", items: ["HTTPS via Nginx TLS termination", "Internal service communication: plaintext on private 172.20.0.0/24", "Redis and RabbitMQ on private network only"], color: "blue" },
                { icon: "👁️‍🗨️", title: "Vote Privacy", items: ["ElGamal encrypts per-selection", "Homomorphic tally: votes counted encrypted", "No voter↔ballot linkage in DB schema"], color: "green" },
                { icon: "✅", title: "Integrity Proofs", items: ["Chaum-Pedersen proofs per decryption share", "Schnorr proofs per ballot selection", "All proofs downloadable for independent verification"], color: "teal" },
                { icon: "🤖", title: "Anti-Fraud", items: ["FingerprintJS BotD 1.9.1 browser-side", "5-minute timestamp freshness check server-side", "OTP rate limiting + 5-min expiry"], color: "red" },
                { icon: "🏗️", title: "Threshold Security", items: ["k-of-n Shamir-style guardian quorum", "No single guardian can decrypt alone", "Lagrange compensation for absent guardians"], color: "orange" },
              ].map(({ icon, title, items, color }) => (
                <div key={title} className={`bg-white rounded-2xl border p-5 ${color === "purple" ? "border-purple-200" : color === "blue" ? "border-blue-200" : color === "green" ? "border-green-200" : color === "teal" ? "border-teal-200" : color === "red" ? "border-red-200" : "border-orange-200"}`}>
                  <div className="text-2xl mb-2">{icon}</div>
                  <h3 className="font-bold text-gray-900 mb-3">{title}</h3>
                  <ul className="space-y-1.5">
                    {items.map((item) => (
                      <li key={item} className="flex items-start text-sm text-gray-700"><span className="mr-2 text-gray-400 flex-shrink-0">•</span>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════ ELGAMAL ═══════════════════════ */}
        {activeTab === "elgamal" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">ElGamal End-to-End Verifiable Encryption</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <div className="bg-gray-900 rounded-2xl p-6 mb-6 font-mono text-sm">
                  <div className="text-green-400 font-bold mb-4">// ElGamal Encryption (Twisted / ElectionGuard variant)</div>
                  <div className="text-gray-300 space-y-2 text-xs leading-relaxed">
                    <div className="text-gray-500">// Setup: 4096-bit safe prime p, generator g</div>
                    <div><span className="text-yellow-300">p</span> = 4096-bit safe prime (NIST group)</div>
                    <div><span className="text-yellow-300">g</span> = generator of cyclic group G of order q</div>
                    <div><span className="text-yellow-300">q</span> = (p-1)/2 (large Sophie Germain prime)</div>
                    <br />
                    <div className="text-gray-500">// Key generation per guardian i:</div>
                    <div><span className="text-blue-300">s_i</span> ← random ∈ [2, q-2]  <span className="text-gray-500">// secret key</span></div>
                    <div><span className="text-blue-300">K_i</span> = g^s_i mod p       <span className="text-gray-500">// public key share</span></div>
                    <div>K = ∏ K_i mod p          <span className="text-gray-500">// combined public key</span></div>
                    <br />
                    <div className="text-gray-500">// Ballot encryption per selection m ∈ {"{0, 1}"}:</div>
                    <div><span className="text-purple-300">ξ</span> ← random nonce ∈ [2, q-2]</div>
                    <div>α = g^ξ mod p</div>
                    <div>β = g^m · K^ξ mod p</div>
                    <div>ciphertext = (α, β)      <span className="text-gray-500">// transmitted + stored</span></div>
                    <br />
                    <div className="text-gray-500">// Homomorphic tally of n ballots:</div>
                    <div>A = ∏ α_i mod p</div>
                    <div>B = ∏ β_i mod p          <span className="text-gray-500">// encrypted sum of votes</span></div>
                    <br />
                    <div className="text-gray-500">// Partial decryption by guardian i:</div>
                    <div><span className="text-orange-300">M_i</span> = A^s_i mod p     <span className="text-gray-500">// partial decryption</span></div>
                    <br />
                    <div className="text-gray-500">// Final tally:</div>
                    <div>M = ∏ M_i^{"{λ_i}"} mod p <span className="text-gray-500">// Lagrange combine</span></div>
                    <div>t = log_g(B · M^-1 mod p) <span className="text-gray-500">// discrete log = vote count</span></div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
                  <h3 className="font-bold text-purple-900 mb-3">Why 4096-bit?</h3>
                  <p className="text-purple-800 text-sm mb-3">4096-bit discrete log provides ~200 bits of classical security (comparable to AES-200, far beyond AES-128). NIST recommends ≥2048-bit for elections through 2030+. AmarVote uses 4096-bit for long-term security of encrypted ballots.</p>
                  <div className="bg-white rounded-lg p-3 font-mono text-xs text-gray-600 border border-purple-100">
                    <div>Classical security: ~200 bits</div>
                    <div>Best attack: Number Field Sieve</div>
                    <div>Key size: 4096 bits (prime modulus)</div>
                    <div>Exponent size: ~256 bits (order q)</div>
                    <div>gmpy2: GMP-accelerated bignum arithmetic</div>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                  <h3 className="font-bold text-blue-900 mb-3">Threshold Decryption — Lagrange Interpolation</h3>
                  <p className="text-blue-800 text-sm mb-3">With k-of-n threshold, guardian i holds polynomial coefficient share. Any k guardians can reconstruct using Lagrange basis polynomials:</p>
                  <div className="bg-white rounded-lg p-3 font-mono text-xs text-gray-600 border border-blue-100">
                    <div>λ_i = ∏_j≠i j / (j - i) mod q  // Lagrange coefficient</div>
                    <div>M = ∏_i M_i^λ_i mod p         // combined result</div>
                    <div className="mt-2 text-gray-400">// Absent guardian compensation:</div>
                    <div>// Present guardian j uses backup polynomial</div>
                    <div>// to generate share on behalf of absent guardian i</div>
                    <div>M_comp_j_for_i = A^(f_j(i) · λ_j(S_i)) mod p</div>
                  </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                  <h3 className="font-bold text-green-900 mb-3">Tracking Code Generation</h3>
                  <p className="text-green-800 text-sm">Each encrypted ballot receives a unique tracking code = SHA-256(concatenation of all ciphertext pairs). Voters can confirm their code appears on the public bulletin board after election closes.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════ POST-QUANTUM ═══════════════════════ */}
        {activeTab === "postquantum" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Post-Quantum Cryptography — ML-KEM-1024</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div>
                <div className="bg-gray-900 rounded-2xl p-6 font-mono text-xs text-gray-300 mb-4">
                  <div className="text-green-400 font-bold mb-4 text-sm">// Guardian Key Protection Stack</div>
                  <pre className="whitespace-pre-wrap leading-relaxed">{`// Layer 1: Generate ElGamal secret key
s_i ← ElectionGuard.generate_guardian_keypair()
// s_i is a 4096-bit integer (ElGamal private key)

// Layer 2: Derive wrapping key from password
p_hash = scrypt(password, salt,
               N=65536, r=8, p=1, dkLen=32)
// N=2^16: ~65ms on modern hardware (tunable)

// Layer 3: ML-KEM-1024 Key Encapsulation
(pk_kem, sk_kem) = ML_KEM_1024.keygen()
(ciphertext_kem, K_kem) = ML_KEM_1024.encap(pk_kem)
// K_kem = 32-byte shared secret (quantum resistant)

// Layer 4: AES-256-CBC symmetric encryption
iv ← os.urandom(16)
aes_key = HKDF(K_kem, p_hash)  // derived key
ciphertext_aes = AES_256_CBC.encrypt(
    msgpack.encode(s_i), aes_key, iv)

// Layer 5: HMAC-SHA256 authentication tag
tag = HMAC_SHA256(aes_key, ciphertext_kem + iv
                           + ciphertext_aes)

// Final credential file (JSON):
{
  "kem_ciphertext": base64(ciphertext_kem),
  "iv": base64(iv),
  "ciphertext": base64(ciphertext_aes),
  "tag": base64(tag),
  "guardian_id": "...",
  "election_id": "..."
}`}</pre>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
                  <h3 className="font-bold text-indigo-900 mb-3">Why ML-KEM-1024?</h3>
                  <div className="space-y-3 text-sm text-indigo-800">
                    <p><strong>CRYSTALS-Kyber</strong> was selected by NIST in 2022 and standardized as FIPS 203 (ML-KEM) in 2024. It is based on the Module Learning With Errors (MLWE) problem, which is believed to be hard for both classical and quantum computers.</p>
                    <p><strong>Shor's algorithm</strong> breaks RSA and elliptic-curve cryptography in polynomial time on a quantum computer, but has no known efficient attack on MLWE. Guardian keys must remain secret even after a quantum computer is built — hence post-quantum wrapping is essential for long-term election integrity.</p>
                    <p>ML-KEM-1024 provides <strong>≥256-bit post-quantum security</strong> (NIST Category 5).</p>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h3 className="font-bold text-gray-900 mb-3">Decryption Flow (Guardian side)</h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    {[
                      "Guardian uploads credential .json file via browser",
                      "Backend verifies HMAC-SHA256 tag (tamper check)",
                      "ML-KEM-1024 decapsulation: K_kem = sk_kem.decap(ciphertext_kem)",
                      "Scrypt KDF re-derives wrapping key from guardian's password",
                      "HKDF combines K_kem + p_hash → aes_key",
                      "AES-256-CBC decrypt → msgpack → ElGamal private key",
                      "Private key stored in Redis with 6h TTL for worker use",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start">
                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">{i + 1}</div>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════ ZK PROOFS ═══════════════════════ */}
        {activeTab === "zkproofs" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Zero-Knowledge Proofs</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Schnorr Proof — Ballot Validity</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-6 text-sm text-gray-700">
                  <p className="mb-3">Every ballot selection carries a Schnorr σ-protocol proof that the encrypted value is either 0 or 1 — without revealing which. This ensures voters cannot encrypt values like 5 (stuffing) while preserving ballot secrecy.</p>
                  <div className="bg-gray-900 text-green-300 rounded-xl p-4 font-mono text-xs">
                    <div className="text-gray-500 mb-2">// Disjunctive Schnorr proof (OR-composition)</div>
                    <div>Proves: m ∈ {"{0, 1}"} without revealing m</div>
                    <div className="mt-2">Prover knows: ξ (encryption nonce), m ∈ {"{0, 1}"}</div>
                    <div>Verifier checks: The proof π is valid for ciphertext (α,β)</div>
                    <div className="mt-2 text-gray-400">Protocol: Non-interactive via Fiat-Shamir heuristic</div>
                    <div>Challenge: c = H(α, β, A_0, B_0, A_1, B_1)</div>
                    <div>Response: r = ξ - c·(m selection) mod q</div>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Chaum-Pedersen Proof — Decryption Correctness</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-sm text-gray-700">
                  <p className="mb-3">Each guardian's partial decryption M_i = A^s_i comes with a Chaum-Pedersen proof proving they used the correct secret key — without revealing s_i. This is what makes decryption independently verifiable.</p>
                  <div className="bg-gray-900 text-green-300 rounded-xl p-4 font-mono text-xs">
                    <div className="text-gray-500 mb-2">// Chaum-Pedersen discrete log equality proof</div>
                    <div>Proves: DL_g(K_i) == DL_A(M_i)</div>
                    <div>I.e.: log_g(K_i) == log_A(M_i) == s_i</div>
                    <div className="mt-2">Witness: s_i (guardian secret key)</div>
                    <div>Public: g, A (encrypted tally), K_i (public key), M_i (partial decryption)</div>
                    <div className="mt-2 text-gray-400">Non-interactive (Fiat-Shamir):</div>
                    <div>u ← random; a = g^u; b = A^u</div>
                    <div>c = H(g, A, K_i, M_i, a, b)  // challenge</div>
                    <div>v = u − c·s_i mod q           // response</div>
                    <div>Verify: g^v·K_i^c == a AND A^v·M_i^c == b</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6">
                  <h3 className="font-bold text-green-900 mb-4">What Voters Can Verify</h3>
                  <div className="space-y-3 text-sm">
                    {[
                      ["Ballot was recorded", "Tracking code appears on public bulletin board"],
                      ["Ballot was not modified", "SHA-256(ciphertext) matches bulletin board entry"],
                      ["Ballot was tallied", "Ciphertext is included in homomorphic product"],
                      ["Decryption was honest", "Download Chaum-Pedersen proof + verify: g^v·K^c == a, A^v·M^c == b"],
                      ["Ballot was valid", "Schnorr proof verifies selection ∈ {0,1}"],
                      ["Result is correct", "Discrete log of final decryption matches announced tally"],
                    ].map(([claim, how]) => (
                      <div key={claim} className="flex items-start bg-white rounded-lg p-3 border border-green-100">
                        <span className="text-green-600 mr-2 flex-shrink-0">✓</span>
                        <div><strong className="text-green-900">{claim}:</strong> <span className="text-green-800">{how}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h3 className="font-bold text-gray-900 mb-3">Third-Party Verification</h3>
                  <p className="text-sm text-gray-700 mb-3">All cryptographic material is downloadable:</p>
                  <ul className="space-y-1 text-sm text-gray-700">
                    {[
                      "Election public key (combined K = ∏ K_i)",
                      "All encrypted ballots with Schnorr proofs",
                      "Encrypted tally chunks",
                      "All partial decryption shares with Chaum-Pedersen proofs",
                      "All compensated shares with respective proofs",
                      "Final election result JSON",
                    ].map((item) => (
                      <li key={item} className="flex items-start"><span className="mr-2 text-gray-400">📄</span>{item}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-500 mt-3">Any auditor with the ElectionGuard verifier can re-run verification independently.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════ BENALOH ═══════════════════════ */}
        {activeTab === "benaloh" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Benaloh Challenge — Cast-or-Spoil Protocol</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
                  <h3 className="font-bold text-amber-900 mb-3">Why Benaloh Challenge?</h3>
                  <p className="text-amber-800 text-sm mb-3">A malicious client could show a voter an honest-looking ballot while actually encrypting a different choice (software attack). The Benaloh challenge solves this without compromising cast ballot secrecy.</p>
                  <p className="text-amber-800 text-sm">Key insight: A ciphertext cannot both be correctly opened AND counted as a real vote. So challenging = spoiling = you must re-vote. But you've proven the system encrypts honestly.</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h3 className="font-bold text-gray-900 mb-4">Protocol Flow</h3>
                  <div className="space-y-4">
                    {[
                      { n: "1", label: "Encryption", color: "blue", text: "Voter selects candidate. Frontend calls EG API to encrypt → receives (α, β) ciphertext pairs + Schnorr proof. Tracking code shown." },
                      { n: "2", label: "Decision Point", color: "yellow", text: "Voter chooses: CAST (vote counted) or CHALLENGE (request nonce)." },
                      { n: "3", label: "If CHALLENGE", color: "orange", text: "Frontend calls /challenge endpoint → EG API returns nonce ξ. Voter can independently verify: α = g^ξ and β = g^m · K^ξ using the election public key." },
                      { n: "4", label: "Spoil", color: "red", text: "Challenged ballot is marked spoiled (publicly logged). Voter's choice is now revealed in the spoiled ballot — but this ballot is NOT counted. Voter must vote again." },
                      { n: "5", label: "If CAST", color: "green", text: "No nonce exposure. Ballot encrypted and counted. Tracking code recorded on public bulletin board. Voter cannot later demand nonce." },
                    ].map(({ n, label, color, text }) => (
                      <div key={n} className="flex items-start">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mr-3 mt-0.5 ${color === "blue" ? "bg-blue-500" : color === "yellow" ? "bg-yellow-500" : color === "orange" ? "bg-orange-500" : color === "red" ? "bg-red-500" : "bg-green-500"}`}>{n}</div>
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{label}</div>
                          <p className="text-gray-600 text-sm">{text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <div className="bg-gray-900 rounded-2xl p-6 font-mono text-xs text-gray-300 mb-6">
                  <div className="text-green-400 font-bold mb-3">// Benaloh Soundness Guarantee</div>
                  <pre className="whitespace-pre-wrap leading-relaxed">{`// Any software that encrypts dishonestly faces a dilemma:

// Case 1: Voter challenges every ballot
// → If software encrypts wrong choice, nonce reveal
//   exposes the fraud (α ≠ g^ξ or β ≠ g^fraud·K^ξ)
// → Software CANNOT fake a valid nonce after the fact
//   (discrete log hardness)

// Case 2: Software encrypts honestly (good)
// → Nonce reveals correct choice, voter satisfied
// → When voter casts, encryption is correct

// Probabilistic security:
// With probability p_challenge per contest,
// fraud probability < (1 - p_challenge)^audits
// → Repeated challenging makes fraud exponentially unlikely

// AmarVote implementation:
// /ballot/challenge → returns {nonce: ξ, ...}
// Only available BEFORE cast decision
// Challenge = automatic spoil; voter must re-encrypt`}</pre>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
                  <h3 className="font-bold text-purple-900 mb-3">Auditability of Spoiled Ballots</h3>
                  <p className="text-purple-800 text-sm mb-3">All spoiled (challenged) ballots are recorded on the public bulletin board with their nonces. This creates a public audit trail proving the system encrypted honestly during the election period.</p>
                  <div className="space-y-2 text-sm text-purple-700">
                    <div>• Spoiled ballot: (α, β, ξ, m_actual) all public</div>
                    <div>• Verify: α == g^ξ mod p ✓</div>
                    <div>• Verify: β == g^m_actual · K^ξ mod p ✓</div>
                    <div>• Spoiled ballots excluded from tally</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════ AUTH ═══════════════════════ */}
        {activeTab === "auth" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Authentication & Access Control</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-5">
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h3 className="font-bold text-gray-900 mb-4">OTP Passwordless Authentication</h3>
                  <div className="space-y-3 text-sm text-gray-700">
                    {[
                      ["6-digit code", "Generated via Java SecureRandom — cryptographically random"],
                      ["5-minute TTL", "Stored in DB with expiry; server rejects expired OTPs"],
                      ["Single use", "OTP invalidated immediately after first validation"],
                      ["Gmail SMTP", "Spring Mail via Google SMTP relay; TLS required"],
                      ["Rate limiting", "OTP request rate limited per IP + email combination"],
                      ["No password", "Users never create passwords; eliminates credential stuffing vectors"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-start">
                        <span className="font-semibold text-blue-700 w-28 flex-shrink-0">{k}</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h3 className="font-bold text-gray-900 mb-4">JWT Session Architecture</h3>
                  <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs text-gray-300 mb-3">
                    <div className="text-yellow-300">// JWT Payload</div>
                    <div>{`{`}</div>
                    <div>  <span className="text-blue-300">"sub"</span>: <span className="text-green-300">"user@example.com"</span>,</div>
                    <div>  <span className="text-blue-300">"role"</span>: <span className="text-green-300">"VOTER" | "GUARDIAN" | "ADMIN"</span>,</div>
                    <div>  <span className="text-blue-300">"iat"</span>: <span className="text-orange-300">1704067200</span>,</div>
                    <div>  <span className="text-blue-300">"exp"</span>: <span className="text-orange-300">1704672000</span> <span className="text-gray-500">// iat + 7 days</span></div>
                    <div>{`}`}</div>
                    <div className="mt-2 text-gray-500">// Signed with HMAC-SHA256</div>
                    <div className="text-gray-500">// Stored as HttpOnly cookie (not accessible to JS)</div>
                    <div className="text-gray-500">// Spring Security validates on every request</div>
                  </div>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div><strong>Library:</strong> JJWT 0.12.6</div>
                    <div><strong>Duration:</strong> 7 days</div>
                    <div><strong>Storage:</strong> HttpOnly cookie (XSS-safe)</div>
                    <div><strong>CSRF:</strong> Spring Security CSRF + SameSite cookie</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
                  <h3 className="font-bold text-gray-900 mb-4">Role-Based Access Control</h3>
                  <div className="space-y-4">
                    {[
                      { role: "VOTER", perms: ["Browse public elections", "View eligible restricted elections", "Cast ballots (one per election)", "Check ballot tracking code", "View election results"], endpoints: ["/elections/**", "/ballot/cast", "/ballot/track"] },
                      { role: "GUARDIAN", perms: ["All voter permissions", "Submit credential file for decryption", "Marked decrypted_or_not after contribution"], endpoints: ["/guardian/submit-key", "/guardian/decrypt/**"] },
                      { role: "ADMIN", perms: ["All guardian permissions", "Create/edit elections", "Upload images (Cloudinary)", "Manage voter eligibility lists", "Initiate tally and combine operations", "View API audit logs"], endpoints: ["/admin/**", "/election/create", "/election/tally"] },
                    ].map(({ role, perms, endpoints }) => (
                      <div key={role} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <div className="font-bold text-gray-900 mb-2 font-mono">{role}</div>
                        <ul className="space-y-1 mb-2">
                          {perms.map((p) => <li key={p} className="text-sm text-gray-700 flex items-start"><span className="mr-1.5 text-green-500">✓</span>{p}</li>)}
                        </ul>
                        <div className="flex flex-wrap gap-1">
                          {endpoints.map((e) => <span key={e} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-mono text-xs">{e}</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════ TRANSPORT ═══════════════════════ */}
        {activeTab === "transport" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Ballot Transport Security</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h3 className="font-bold text-gray-900 mb-4">PKCS#7 Ballot Padding</h3>
                  <p className="text-gray-700 text-sm mb-3">All ballot submission HTTP requests are padded to a fixed size using PKCS#7 padding. This prevents traffic-analysis attacks where an adversary monitors request sizes to infer vote distribution.</p>
                  <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs text-gray-300">
                    <div className="text-green-400 mb-2">// Without padding (VULNERABLE):</div>
                    <div className="text-red-400">POST /ballot &#123; size: 1024 &#125;  → "Candidate A" (small)</div>
                    <div className="text-red-400">POST /ballot &#123; size: 2048 &#125;  → "Candidate B" (large)</div>
                    <div className="mt-3 text-green-400">// With PKCS#7 padding (SAFE):</div>
                    <div className="text-green-300">POST /ballot &#123; size: 65536 &#125; → any candidate</div>
                    <div className="text-green-300">POST /ballot &#123; size: 65536 &#125; → any candidate</div>
                    <div className="mt-2 text-gray-500">// Attacker cannot distinguish between choices</div>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h3 className="font-bold text-gray-900 mb-4">Bot Detection — FingerprintJS BotD 1.9.1</h3>
                  <p className="text-gray-700 text-sm mb-3">The React frontend runs FingerprintJS Bot Detection before rendering the ballot page. The result + a timestamp is included in the ballot submission and validated server-side.</p>
                  <div className="space-y-2 text-sm text-gray-700">
                    {[
                      ["BotD signal", "js bot score (0–1) + isBot flag"],
                      ["Server validation", "Spring Boot checks isBot == false"],
                      ["Timestamp", "Client includes submission timestamp"],
                      ["Freshness check", "Server rejects if |now - timestamp| > 5 minutes"],
                      ["Rejection", "HTTP 403 Forbidden for bot or stale requests"],
                      ["Why both?", "Bot flag catches automation; timestamp prevents replay attacks"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-start">
                        <span className="font-semibold text-purple-700 min-w-36 flex-shrink-0">{k}:</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-5">
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h3 className="font-bold text-gray-900 mb-4">msgpack Binary Serialization</h3>
                  <p className="text-gray-700 text-sm mb-3">4096-bit integers (ElGamal ciphertexts) have extremely large JSON string representations. msgpack stores them as compact binary sequences, providing 10–50× size reduction and faster (de)serialization.</p>
                  <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs text-gray-300 mb-3">
                    <div className="text-red-400">JSON: "alpha": "123456...1024_digit_number"</div>
                    <div className="text-red-400">Size: ~1234 bytes per ciphertext pair</div>
                    <div className="mt-2 text-green-400">msgpack: \x08\x10\xf9...\x12</div>
                    <div className="text-green-400">Size: ~514 bytes per ciphertext pair</div>
                    <div className="mt-2 text-gray-500">Library: jackson-dataformat-msgpack 0.9.8 (Java)</div>
                    <div className="text-gray-500">         msgpack-python (Python workers)</div>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h3 className="font-bold text-gray-900 mb-4">API Audit Logging</h3>
                  <p className="text-gray-700 text-sm mb-3">All API requests and responses are logged to the api_log table in PostgreSQL with request body, response body, status code, execution time, and user identity (if authenticated).</p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div><strong>Table:</strong> api_log</div>
                    <div><strong>Fields:</strong> method, path, status_code, request_body, response_body, execution_ms, user_email, timestamp</div>
                    <div><strong>Admin view:</strong> /api-logs page in admin dashboard (paginated)</div>
                    <div><strong>Use cases:</strong> Security audit, debugging, performance monitoring</div>
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

export default Security;

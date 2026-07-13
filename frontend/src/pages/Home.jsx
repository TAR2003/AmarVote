import React from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiCheck, FiLock, FiShield, FiEye } from "react-icons/fi";
import Layout from "./Layout";
import BrandMark from "../components/BrandMark";

const TRUST = [
  { value: "4096-bit", label: "ElGamal encryption" },
  { value: "ML-KEM", label: "Post-quantum keys" },
  { value: "E2E", label: "Verifiable ballots" },
  { value: "k-of-n", label: "Threshold decrypt" },
];

const JOURNEY = [
  {
    step: "01",
    title: "Create an election",
    body: "Set guardians, candidates, and eligibility. AmarVote runs a cryptographic key ceremony before voting begins.",
  },
  {
    step: "02",
    title: "Vote privately",
    body: "Ballots are encrypted under the election public key with ElectionGuard. Challenge the encryption before casting, then confirm your ballot is in the tally.",
  },
  {
    step: "03",
    title: "Reveal with quorum",
    body: "Results unlock only when enough guardians contribute shares. Absent guardians can be compensated without breaking integrity.",
  },
];

const PILLARS = [
  {
    icon: FiLock,
    title: "Encrypted ballots",
    body: "Homomorphic tallies mean votes are counted without exposing individual choices.",
  },
  {
    icon: FiShield,
    title: "Post-quantum keys",
    body: "Guardian secrets are wrapped with ML-KEM-1024 for long-term election integrity.",
  },
  {
    icon: FiEye,
    title: "Publicly auditable",
    body: "Tracking codes, Chaum-Pedersen proofs, and published artifacts let anyone verify the outcome.",
  },
];

const ROLES = [
  {
    title: "Voters",
    body: "Cast encrypted ballots, challenge encryption, and confirm inclusion on the bulletin board.",
  },
  {
    title: "Guardians",
    body: "Hold threshold key shares. Decrypt only together—never alone.",
  },
  {
    title: "Admins",
    body: "Run key ceremonies, tallies, and transparent results.",
  },
];

const Home = () => {
  return (
    <Layout>
      {/* Hero — brand-first, full-bleed, single composition */}
      <section className="hero-stage min-h-[min(92dvh,880px)] px-4 pb-20 pt-16 sm:pb-28 sm:pt-24">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 top-1/4 h-80 w-80 animate-aurora-drift rounded-full bg-brand/15 blur-3xl" />
          <div className="absolute -right-16 bottom-1/4 h-96 w-96 animate-aurora-drift rounded-full bg-aurora/8 blur-3xl [animation-delay:2s]" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center text-center">
          <div className="mb-8 animate-float">
            <BrandMark size="xl" className="shadow-brand ring-4 ring-paper/10" />
          </div>

          <p className="font-display text-5xl font-extrabold tracking-tight text-paper animate-fade-up sm:text-7xl lg:text-8xl">
            AmarVote
          </p>

          <h1 className="mt-5 max-w-2xl font-display text-xl font-semibold text-paper text-balance animate-fade-up [animation-delay:100ms] sm:text-3xl">
            End-to-end verifiable elections
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-dusk-soft text-balance animate-fade-up [animation-delay:180ms] sm:text-lg">
            ElectionGuard cryptography — guardian key ceremonies, encrypted ballots, and Benaloh challenges.
          </p>

          <div className="mt-10 flex w-full max-w-md flex-col gap-3 animate-fade-up [animation-delay:260ms] sm:max-w-none sm:flex-row sm:justify-center">
            <Link to="/register" className="btn-brand px-8 py-3.5 text-base shadow-brand">
              Get started
              <FiArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/how-it-works" className="btn-ghost-light px-8 py-3.5 text-base">
              See how it works
            </Link>
          </div>
        </div>
      </section>

      {/* Trust strip — one job: credibility */}
      <section className="border-b border-ink/10 bg-paper">
        <div className="mx-auto grid max-w-5xl grid-cols-2 divide-x divide-y divide-ink/5 sm:grid-cols-4 sm:divide-y-0">
          {TRUST.map((item) => (
            <div key={item.label} className="px-4 py-8 text-center sm:px-6">
              <div className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
                {item.value}
              </div>
              <div className="mt-1 text-sm text-dusk">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Journey */}
      <section className="bg-frost-mesh px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-kicker">The experience</p>
            <h2 className="section-title mt-3">From ceremony to certified results</h2>
            <p className="section-sub">
              Three moments. Zero compromise. Designed so every role knows exactly what to do next.
            </p>
          </div>

          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {JOURNEY.map((item) => (
              <div key={item.step} className="relative">
                <span className="font-display text-5xl font-extrabold text-brand/25">{item.step}</span>
                <h3 className="mt-2 font-display text-xl font-bold text-ink">{item.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-dusk">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security pillars */}
      <section className="bg-paper px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-kicker">Cryptographic trust</p>
            <h2 className="section-title mt-3">Cryptographic integrity</h2>
            <p className="section-sub">
              ElectionGuard primitives with published proofs anyone can check.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {PILLARS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="surface-card-interactive p-7">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand-dark">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-display text-lg font-bold text-ink">{title}</h3>
                <p className="mt-2 text-base leading-relaxed text-dusk">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link to="/security" className="link-brand inline-flex items-center gap-2 text-base font-semibold">
              Explore the full security model
              <FiArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Roles — deep band */}
      <section className="relative overflow-hidden bg-deep px-4 py-20 sm:py-28">
        <div className="pointer-events-none absolute inset-0 bg-hero-grid opacity-30" style={{ backgroundSize: "48px 48px" }} />
        <div className="relative mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dusk-soft">Roles</p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-paper sm:text-4xl">
              Voters, guardians, and admins
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {ROLES.map((role) => (
              <div
                key={role.title}
                className="rounded-2xl border border-white/10 bg-paper/5 p-7 backdrop-blur-sm transition duration-200 hover:border-brand/40 hover:bg-paper/[0.08]"
              >
                <h3 className="font-display text-xl font-bold text-paper">{role.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-dusk-soft">{role.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo + proof */}
      <section className="bg-frost-mesh px-4 py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="section-kicker">Demo</p>
            <h2 className="section-title mt-3">Platform walkthrough</h2>
            <p className="section-sub !mx-0">
              From election setup through guardian decryption to published results.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                "Encrypted casting with Benaloh challenge",
                "Guardian threshold decryption",
                "Verifiable published results",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-base text-ink">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sage-soft text-aurora-muted">
                    <FiCheck className="h-3 w-3" aria-hidden="true" />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4">
            <a
              href="https://youtu.be/ixsvvl_7qVo"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative overflow-hidden rounded-2xl bg-deep-sheen p-8 text-left shadow-lift transition duration-200 hover:-translate-y-0.5"
            >
              <div className="absolute inset-0 bg-brand/0 transition group-hover:bg-brand/10" />
              <div className="relative">
                <span className="text-xs font-semibold uppercase tracking-wider text-dusk-soft">Platform demo</span>
                <h3 className="mt-2 font-display text-xl font-bold text-paper">Election to results</h3>
                <p className="mt-2 text-base text-dusk-soft">
                  Creation, casting, guardians, and verification in one walkthrough.
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-base font-semibold text-brand-light">
                  Watch on YouTube <FiArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </div>
            </a>
            <a
              href="https://youtu.be/t8VOLdYIV40"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative overflow-hidden rounded-2xl border border-ink/10 bg-paper p-8 text-left shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-lift"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-dark">Infrastructure</span>
              <h3 className="mt-2 font-display text-xl font-bold text-ink">Under the hood</h3>
              <p className="mt-2 text-base text-dusk">
                Services, queues, and the ElectionGuard worker architecture.
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-base font-semibold text-brand-dark">
                Watch deep dive <FiArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA — deep indigo, never gold-as-surface */}
      <section className="relative overflow-hidden bg-deep px-4 py-20 sm:py-24">
        <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-48 w-48 rounded-full bg-aurora/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-6 h-px w-16 bg-ceremonial" aria-hidden="true" />
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-paper text-balance sm:text-4xl">
            Start with AmarVote
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-dusk-soft sm:text-lg">
            Register, enable MFA, and create your first election.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link to="/register" className="btn-brand px-8 py-3.5 text-base shadow-brand">
              Create your account
              <FiArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/architecture" className="btn-ghost-light px-8 py-3.5 text-base">
              View architecture
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Home;

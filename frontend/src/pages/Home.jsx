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
    title: "Create with confidence",
    body: "Set guardians, candidates, and eligibility. AmarVote runs a cryptographic key ceremony before a single vote is cast.",
  },
  {
    step: "02",
    title: "Vote in private",
    body: "Ballots are encrypted in the browser. You can challenge encryption before casting—then verify your ballot made the tally.",
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
    title: "Encrypted by design",
    body: "Homomorphic tallies mean votes are counted without ever exposing individual choices.",
  },
  {
    icon: FiShield,
    title: "Quantum-ready keys",
    body: "Guardian secrets are wrapped with ML-KEM-1024 so tomorrow’s attacks don’t break today’s elections.",
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
    body: "Orchestrate ceremonies, tallies, and transparent results with calm operational control.",
  },
];

const Home = () => {
  return (
    <Layout>
      {/* Hero — brand-first, full-bleed, single composition */}
      <section className="hero-stage min-h-[min(92dvh,880px)] px-4 pb-20 pt-16 sm:pb-28 sm:pt-24">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 top-1/4 h-80 w-80 animate-aurora-drift rounded-full bg-brand/20 blur-3xl" />
          <div className="absolute -right-16 bottom-1/4 h-96 w-96 animate-aurora-drift rounded-full bg-brand-light/10 blur-3xl [animation-delay:2s]" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center text-center">
          <div className="mb-8 animate-float">
            <BrandMark size="xl" className="shadow-brand ring-4 ring-white/10" />
          </div>

          <p className="font-display text-5xl font-extrabold tracking-tight text-white animate-fade-up sm:text-7xl lg:text-8xl">
            AmarVote
          </p>

          <h1 className="mt-5 max-w-2xl font-display text-xl font-semibold text-brand-light text-balance animate-fade-up [animation-delay:100ms] sm:text-3xl">
            Secure, verifiable digital democracy
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-300 text-balance animate-fade-up [animation-delay:180ms] sm:text-lg">
            End-to-end encrypted elections that feel calm to run and impossible to corrupt—
            ElectionGuard cryptography, without the intimidation.
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
      <section className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto grid max-w-5xl grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">
          {TRUST.map((item) => (
            <div key={item.label} className="px-4 py-8 text-center sm:px-6">
              <div className="font-display text-xl font-bold tracking-tight text-deep sm:text-2xl">
                {item.value}
              </div>
              <div className="mt-1 text-sm text-slate-500">{item.label}</div>
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
                <span className="font-display text-5xl font-extrabold text-brand/20">{item.step}</span>
                <h3 className="mt-2 font-display text-xl font-bold text-deep">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security pillars — visual, not emoji dump */}
      <section className="bg-white px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-kicker">Cryptographic trust</p>
            <h2 className="section-title mt-3">Integrity you can feel</h2>
            <p className="section-sub">
              Strong primitives, clear language—security that builds confidence instead of anxiety.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {PILLARS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="surface-card-interactive p-7">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-glacier text-brand-dark">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-lg font-bold text-deep">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link to="/security" className="link-brand inline-flex items-center gap-2 text-sm font-semibold">
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-light">Built for every role</p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-4xl">
              One platform. Three clear paths.
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {ROLES.map((role) => (
              <div
                key={role.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur-sm transition duration-300 hover:border-brand/40 hover:bg-white/[0.08]"
              >
                <h3 className="font-display text-xl font-bold text-white">{role.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">{role.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo + proof */}
      <section className="bg-frost-mesh px-4 py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="section-kicker">See it live</p>
            <h2 className="section-title mt-3">Watch AmarVote in motion</h2>
            <p className="section-sub">
              From election setup to guardian decryption—see the full flow without reading a whitepaper first.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                "Encrypted casting with Benaloh challenge",
                "Guardian threshold decryption",
                "Verifiable published results",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-sm text-slate-700 sm:text-base">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage">
                    <FiCheck className="h-3 w-3" />
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
              className="group relative overflow-hidden rounded-2xl bg-deep-sheen p-8 text-left shadow-lift transition duration-300 hover:-translate-y-0.5"
            >
              <div className="absolute inset-0 bg-brand/0 transition group-hover:bg-brand/10" />
              <div className="relative">
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-light">Platform demo</span>
                <h3 className="mt-2 font-display text-xl font-bold text-white">Election to results</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Creation, casting, guardians, and verification in one walkthrough.
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-light">
                  Watch on YouTube <FiArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </div>
            </a>
            <a
              href="https://youtu.be/t8VOLdYIV40"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 text-left shadow-soft transition duration-300 hover:-translate-y-0.5 hover:shadow-lift"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-dark">Infrastructure</span>
              <h3 className="mt-2 font-display text-xl font-bold text-deep">Under the hood</h3>
              <p className="mt-2 text-sm text-slate-600">
                Services, queues, and the ElectionGuard worker architecture.
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-dark">
                Watch deep dive <FiArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-brand-glow px-4 py-20 sm:py-24">
        <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-white text-balance sm:text-4xl">
            Run an election people can trust
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/90 sm:text-lg">
            Register, secure your account with MFA, and open your first ceremony in minutes.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-bold text-brand-dark shadow-lift transition hover:bg-glacier active:scale-[0.98]"
            >
              Create your account
              <FiArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/architecture"
              className="inline-flex items-center justify-center rounded-xl border border-white/40 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-white/10"
            >
              View architecture
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Home;

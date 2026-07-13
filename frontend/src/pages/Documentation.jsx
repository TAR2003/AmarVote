import React from "react";
import Layout from "./Layout";
import MarketingHero from "../components/MarketingHero";

const SectionCard = ({ title, children }) => (
  <section className="surface-card glass-panel p-6 sm:p-7">
    <h2 className="font-display text-xl font-bold text-deep mb-4">{title}</h2>
    {children}
  </section>
);

const Code = ({ children }) => (
  <code className="px-2 py-1 rounded-lg bg-glacier text-brand-dark text-sm font-mono">{children}</code>
);

function Documentation() {
  return (
    <Layout>
      <MarketingHero
        kicker="Docs"
        title="Platform documentation"
        subtitle="Routes and permissions as implemented today—a living snapshot of AmarVote’s access rules and structure."
      />

      <div className="marketing-page max-w-5xl mx-auto px-4 py-12 sm:py-16 space-y-6 page-enter">
        <SectionCard title="Authentication and Login Rules">
          <ul className="space-y-3 text-dusk leading-relaxed list-disc pl-5">
            <li>Login is restricted to authorized users when registration is not open to all.</li>
            <li>
              Access checks are enforced in backend auth flows via <Code>ensureAllowedForLogin</Code> and
              <Code> ensureAllowedForRegistration</Code> before login/register steps.
            </li>
            <li>
              Users authenticate through <Code>/api/auth/login</Code> (password with optional MFA) or
              <Code> /api/auth/request-otp</Code> and <Code>/api/auth/verify-otp</Code>.
            </li>
            <li>
              Session is maintained using an HttpOnly cookie named <Code>jwtToken</Code>.
            </li>
          </ul>
        </SectionCard>

        <SectionCard title="Roles and Permission Model">
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div className="rounded-2xl border border-ink/10 p-4 bg-frost">
              <h3 className="font-display font-bold text-deep mb-2">User</h3>
              <p className="text-sm text-dusk">Can log in if authorized. Cannot manage authorized-users settings by default.</p>
            </div>
            <div className="rounded-xl border border-brand/20 p-4 bg-glacier">
              <h3 className="font-display font-bold text-deep mb-2">Admin</h3>
              <p className="text-sm text-deep">Can add/remove/update authorized users (except owner records), and manage permission settings.</p>
            </div>
            <div className="rounded-xl border border-brand/25 p-4 bg-glacier">
              <h3 className="font-display font-bold text-deep mb-2">Owner</h3>
              <p className="text-sm text-deep">Full management role. Can promote users to admin and perform all admin operations.</p>
            </div>
          </div>

          <ul className="space-y-3 text-dusk leading-relaxed list-disc pl-5">
            <li>
              Owner records are immutable in the current backend logic: owners cannot be modified or removed via authorized-users APIs.
            </li>
            <li>
              Admin users cannot assign the owner role.
            </li>
            <li>
              Only emails included in <Code>ADMIN_EMAILS</Code> are eligible for owner role.
            </li>
            <li>
              Admins and owners can add or remove users. Remove/edit operations are blocked for owner rows.
            </li>
          </ul>
        </SectionCard>

        <SectionCard title="Election Creation Permission">
          <ul className="space-y-3 text-dusk leading-relaxed list-disc pl-5">
            <li>
              Election creation is validated server-side at <Code>/api/create-election</Code> using
              <Code> canUserCreateElection</Code>.
            </li>
            <li>
              Default system scope is <Code>all_admins_owners</Code>, and users must have
              <Code> canCreateElections=true</Code>.
            </li>
            <li>
              In default configuration, this means admins and owners can create elections.
            </li>
          </ul>
        </SectionCard>

        <SectionCard title="Main Public and App Routes">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl border border-ink/10 p-4">
              <h3 className="font-semibold text-ink mb-2">Public Frontend</h3>
              <ul className="space-y-1 text-dusk list-disc pl-5">
                <li>/</li>
                <li>/features</li>
                <li>/how-it-works</li>
                <li>/architecture</li>
                <li>/security</li>
                <li>/about</li>
                <li>/documentation</li>
                <li>/login</li>
                <li>/register</li>
              </ul>
            </div>
            <div className="rounded-xl border border-ink/10 p-4">
              <h3 className="font-semibold text-ink mb-2">Authenticated Frontend</h3>
              <ul className="space-y-1 text-dusk list-disc pl-5">
                <li>/dashboard</li>
                <li>/create-election</li>
                <li>/election-page/:id</li>
                <li>/all-elections</li>
                <li>/authenticated-users</li>
                <li>/profile</li>
                <li>/api-logs</li>
              </ul>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Core Backend Endpoints">
          <div className="grid md:grid-cols-2 gap-4 text-sm text-dusk">
            <div className="rounded-xl border border-ink/10 p-4">
              <h3 className="font-semibold text-ink mb-2">Auth and Session</h3>
              <ul className="space-y-1 list-disc pl-5">
                <li><Code>/api/auth/register/send-email-code</Code></li>
                <li><Code>/api/auth/register</Code></li>
                <li><Code>/api/auth/login</Code></li>
                <li><Code>/api/auth/request-otp</Code></li>
                <li><Code>/api/auth/verify-otp</Code></li>
                <li><Code>/api/auth/session</Code></li>
              </ul>
            </div>
            <div className="rounded-xl border border-ink/10 p-4">
              <h3 className="font-semibold text-ink mb-2">Authorization and Elections</h3>
              <ul className="space-y-1 list-disc pl-5">
                <li><Code>/api/authorized-users</Code></li>
                <li><Code>/api/authorized-users/audit-logs</Code></li>
                <li><Code>/api/authorized-users/permission-settings</Code></li>
                <li><Code>/api/create-election</Code></li>
                <li><Code>/api/all-elections</Code></li>
                <li><Code>/api/election/{'{id}'}/results</Code></li>
              </ul>
            </div>
          </div>
        </SectionCard>

        <p className="text-xs text-dusk">
          You can find those frontend routes in App.jsx and backend logic in AuthorizedUserService,
          OtpAuthController, MfaAuthService, ElectionController, and SystemSettingService.
        </p>
      </div>
    </Layout>
  );
}

export default Documentation;

/**
 * Tunable probabilities for realistic voter simulation.
 * Override in load-tests/.env.loadtest (REALISTIC_* vars).
 */

function pct(name, fallback) {
  const n = Number(__ENV[name] ?? fallback);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function positiveInt(name, fallback) {
  const n = Number(__ENV[name] ?? fallback);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function realisticConfig() {
  const browseOnlyPct = pct('REALISTIC_BROWSE_ONLY_PCT', 15);
  const eligibilityOnlyPct = pct('REALISTIC_ELIGIBILITY_ONLY_PCT', 10);
  const votePct = Math.max(0, 100 - browseOnlyPct - eligibilityOnlyPct);

  return {
    browseOnlyPct,
    eligibilityOnlyPct,
    votePct,
    extraEncryptPct: pct('REALISTIC_EXTRA_ENCRYPT_PCT', 20),
    extraEncryptMax: positiveInt('REALISTIC_EXTRA_ENCRYPT_MAX', 2),
    includeSession: __ENV.REALISTIC_INCLUDE_SESSION !== '0',
    thinkMinMs: pct('REALISTIC_THINK_MIN_MS', 300),
    thinkMaxMs: pct('REALISTIC_THINK_MAX_MS', 2500),
    browseDetailPct: pct('REALISTIC_BROWSE_DETAIL_PCT', 85),
  };
}

/** @returns {'browse_only'|'eligibility_only'|'vote'} */
export function pickUserIntent(cfg) {
  const roll = Math.random() * 100;
  if (roll < cfg.browseOnlyPct) return 'browse_only';
  if (roll < cfg.browseOnlyPct + cfg.eligibilityOnlyPct) return 'eligibility_only';
  return 'vote';
}

/** Extra encrypt attempts beyond the first (0 = user encrypts once only). */
export function extraEncryptCount(cfg) {
  if (Math.random() * 100 >= cfg.extraEncryptPct) return 0;
  return 1 + Math.floor(Math.random() * cfg.extraEncryptMax);
}

export function totalEncryptAttempts(cfg) {
  return 1 + extraEncryptCount(cfg);
}

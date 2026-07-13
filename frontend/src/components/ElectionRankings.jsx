import React, { useEffect, useMemo, useState } from 'react';
import { FiAward } from 'react-icons/fi';
import CandidateIdentity from './CandidateIdentity';
import {
  buildCompetitionRankings,
  formatOrdinal,
  getCandidateDescription,
  getCandidatePic,
  isWinnerByRank,
} from '../utils/electionRankings';

/**
 * Election Rankings — Ink & Indigo standings list.
 * Ivory rows throughout; gold left-edge + outlined badge for winners only;
 * violet accents for everyone else; serif names/ranks; monospace vote chips.
 */
export default function ElectionRankings({
  chartData = [],
  electionChoices = [],
  winnerCount = 1,
  findChoiceByName,
}) {
  const ranked = useMemo(
    () => buildCompetitionRankings([...(chartData || [])]),
    [chartData]
  );

  const tiedRanks = useMemo(() => {
    const counts = new Map();
    ranked.forEach((c) => counts.set(c.rank, (counts.get(c.rank) || 0) + 1));
    const tied = new Set();
    counts.forEach((n, rank) => {
      if (n > 1) tied.add(rank);
    });
    return tied;
  }, [ranked]);

  const [barReady, setBarReady] = useState(false);
  useEffect(() => {
    setBarReady(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setBarReady(true));
    });
    return () => cancelAnimationFrame(id);
  }, [ranked]);

  if (!ranked.length) return null;

  return (
    <section className="rounded-xl border border-ink/8 bg-paper p-4 sm:p-6 shadow-soft">
      <header className="mb-5 flex items-center gap-2.5">
        <FiAward className="h-5 w-5 shrink-0 text-ceremonial" strokeWidth={1.5} aria-hidden />
        <h4 className="font-display text-lg sm:text-xl font-bold tracking-tight text-deep">
          Election Rankings
        </h4>
      </header>

      <ol className="m-0 list-none space-y-0 p-0">
        {ranked.map((candidate, index) => {
          const isWinner =
            isWinnerByRank(candidate.rank, winnerCount) && candidate.votes > 0;
          const isTied = tiedRanks.has(candidate.rank);
          const positionLabel = formatOrdinal(candidate.rank);
          const share = Number(candidate.percentage) || 0;
          const accentBar = isWinner ? 'bg-ceremonial' : 'bg-brand';
          const photoRing = isWinner
            ? 'ring-2 ring-ceremonial/70 ring-offset-1 ring-offset-paper'
            : 'ring-2 ring-brand/50 ring-offset-1 ring-offset-paper';
          const barFill = isWinner ? 'bg-aurora' : 'bg-brand';
          const partyName = findChoiceByName?.(electionChoices, candidate.name)?.partyName;

          return (
            <li
              key={candidate.name}
              className="animate-fade-up border-b border-ink/[0.06] last:border-b-0"
              style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
            >
              <div className="relative flex items-center gap-3 sm:gap-4 bg-paper py-3.5 pl-3.5 pr-2 sm:py-4 sm:pl-4 sm:pr-3">
                {/* Left-edge accent — gold winners / violet others */}
                <span
                  className={`absolute inset-y-2 left-0 w-[3px] rounded-full ${accentBar}`}
                  aria-hidden
                />

                <div className="w-12 sm:w-14 flex-shrink-0 text-center">
                  <span
                    className={`font-display text-lg sm:text-xl font-bold leading-none tracking-tight ${
                      isWinner ? 'text-deep' : 'text-brand'
                    }`}
                  >
                    {positionLabel}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <CandidateIdentity
                    name={candidate.name}
                    image={getCandidatePic(electionChoices, candidate.name)}
                    description={getCandidateDescription(electionChoices, candidate.name)}
                    partyName={partyName}
                    size="md"
                    enableProfile
                    imageRingClassName={photoRing}
                    nameClassName="font-display text-sm sm:text-base font-semibold tracking-tight text-ink"
                  />
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.06]">
                    <div
                      className={`h-full rounded-full ${barFill} transition-[width] duration-500 ease-out`}
                      style={{ width: barReady ? `${Math.min(share, 100)}%` : '0%' }}
                    />
                  </div>
                </div>

                <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {isWinner && (
                      <span className="rounded border border-ceremonial/70 bg-transparent px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-ceremonial">
                        Winner
                      </span>
                    )}
                    {isTied && (
                      <span className="rounded border border-dusk/25 bg-transparent px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-dusk">
                        Tied
                      </span>
                    )}
                  </div>
                  <span className="rounded border border-ink/10 bg-paper px-2 py-0.5 font-mono text-[11px] sm:text-xs text-ink tracking-tight">
                    {candidate.votes} votes
                  </span>
                  <span className="font-sans text-xs text-dusk">{share}%</span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

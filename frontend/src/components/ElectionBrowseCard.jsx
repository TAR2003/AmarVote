import React, { memo } from "react";
import { FiArrowRight, FiCalendar, FiClock, FiUsers } from "react-icons/fi";

/**
 * Shared election preview tile for Dashboard / All Elections.
 */
const ElectionBrowseCard = memo(function ElectionBrowseCard({
  election,
  status,
  statusClass,
  onOpen,
  actionLabel = "Open",
  actionDisabled = false,
  onAction,
  secondaryAction,
  meta,
  density = "comfortable",
}) {
  const roles = election.userRoles || [];
  const isCompact = density === "compact";

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(election.electionId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.(election.electionId);
        }
      }}
      className={`group relative overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-soft transition duration-300 hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        isCompact ? "p-4" : "p-5 sm:p-6"
      }`}
    >
      <div
        className={`absolute inset-y-0 left-0 w-1 ${
          status === "ongoing"
            ? "bg-sage"
            : status === "upcoming"
              ? "bg-brand"
              : "bg-ink/20"
        }`}
      />

      <div className="flex flex-col gap-4 pl-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {status ? (
              <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusClass}`}>
                {status}
              </span>
            ) : null}
            <span
              className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                election.isPublic ? "bg-sage-soft text-aurora-muted" : "bg-ceremonial-soft text-ink"
              }`}
            >
              {election.isPublic ? "Public" : "Private"}
            </span>
          </div>

          <h3
            className={`mt-2 font-display font-semibold text-deep transition group-hover:text-brand-dark ${
              isCompact ? "text-base" : "text-lg sm:text-xl"
            }`}
          >
            {election.electionTitle}
          </h3>

          {election.electionDescription ? (
            <p className={`mt-1.5 text-sm leading-relaxed text-dusk ${isCompact ? "line-clamp-2" : "line-clamp-3"}`}>
              {election.electionDescription}
            </p>
          ) : null}

          {(roles.length > 0 || meta) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {roles.slice(0, 3).map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center rounded-lg bg-frost px-2 py-1 text-[11px] font-semibold capitalize text-ink"
                >
                  {role}
                </span>
              ))}
              {meta}
            </div>
          )}

          <div className={`mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-dusk ${isCompact ? "" : "sm:text-sm"}`}>
            {election.startingTime || election.endingTime ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <FiCalendar className="h-3.5 w-3.5 text-brand" />
                  {election.startingTime ? new Date(election.startingTime).toLocaleDateString() : "TBD"}
                </span>
                {election.endingTime ? (
                  <span className="inline-flex items-center gap-1.5">
                    <FiClock className="h-3.5 w-3.5 text-brand" />
                    Ends {new Date(election.endingTime).toLocaleDateString()}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <FiClock className="h-3.5 w-3.5 text-brand" />
                Schedule pending
              </span>
            )}
            {election.noOfCandidates != null ? (
              <span className="inline-flex items-center gap-1.5">
                <FiUsers className="h-3.5 w-3.5 text-brand" />
                {election.noOfCandidates} candidates
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[8.5rem] sm:items-stretch">
          {secondaryAction}
          <button
            type="button"
            disabled={actionDisabled}
            onClick={(e) => {
              e.stopPropagation();
              if (onAction) onAction(election.electionId);
              else onOpen?.(election.electionId);
            }}
            className="btn-brand w-full justify-center py-2.5 text-xs sm:text-sm"
          >
            {actionLabel}
            <FiArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
});

export default ElectionBrowseCard;

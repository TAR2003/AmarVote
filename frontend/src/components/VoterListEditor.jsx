import React, { useRef, useState, useEffect, useCallback } from "react";
import { FiUpload, FiTrash2, FiX, FiUsers, FiMail, FiUser } from "react-icons/fi";
import { userApi } from "../utils/userApi";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseVoterEmailsFromText(text) {
  if (!text) return [];

  const tokens = text
    .split(/\r?\n/)
    .flatMap((line) => line.split(/[,;\t]/))
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);

  const valid = [];
  const seen = new Set();

  for (const email of tokens) {
    if (!EMAIL_PATTERN.test(email) || seen.has(email)) {
      continue;
    }
    seen.add(email);
    valid.push(email);
  }

  return valid;
}

function entityLabelTitle(entityLabel) {
  return `${entityLabel.charAt(0).toUpperCase()}${entityLabel.slice(1)}`;
}

/**
 * Reusable voter list editor for election creation and voter management.
 */
export default function VoterListEditor({
  emails,
  onChange,
  onRemove,
  onRemoveAll,
  disabled = false,
  allowRemove = true,
  showManualAdd = true,
  maxHeightClass = "max-h-72",
  emptyMessage = "No voter emails added yet",
  entityLabel = "voter",
  enableUserSuggestions = true,
  /** Emails that must not be added (e.g. the election creator cannot be a co-admin). */
  excludedEmails = [],
  excludedEmailMessage = "This email cannot be added.",
}) {
  const fileInputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const debounceRef = useRef(null);
  const [manualEmail, setManualEmail] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);

  const labelTitle = entityLabelTitle(entityLabel);

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const excludedSet = new Set(
    (excludedEmails || []).map((email) => String(email).trim().toLowerCase()).filter(Boolean)
  );

  const mergeEmails = (incoming) => {
    if (!incoming.length) {
      showFeedback("error", "No new valid email addresses found in the file.");
      return;
    }

    const existing = new Set(emails.map((email) => email.toLowerCase()));
    const blocked = incoming.filter((email) => excludedSet.has(email.toLowerCase()));
    const added = incoming.filter(
      (email) => !existing.has(email.toLowerCase()) && !excludedSet.has(email.toLowerCase())
    );

    if (blocked.length > 0 && added.length === 0 && incoming.length === blocked.length) {
      showFeedback("error", excludedEmailMessage);
      return;
    }

    if (!added.length) {
      showFeedback(
        "info",
        blocked.length > 0
          ? excludedEmailMessage
          : "All emails from the file are already in the list."
      );
      return;
    }

    onChange([...emails, ...added]);
    const skipped = incoming.length - added.length;
    showFeedback(
      "success",
      `Added ${added.length} ${entityLabel}${added.length === 1 ? "" : "s"}${
        skipped > 0
          ? ` (${skipped} skipped${blocked.length > 0 ? ", including excluded emails" : ""})`
          : ""
      }.`
    );
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ["text/plain", "text/csv", "application/vnd.ms-excel"];
    const isValidType =
      validTypes.includes(file.type) ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".csv");

    if (!isValidType) {
      showFeedback("error", "Please upload a .txt or .csv file.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const parsed = parseVoterEmailsFromText(loadEvent.target.result);
      mergeEmails(parsed);
      event.target.value = "";
    };
    reader.onerror = () => {
      showFeedback("error", "Could not read the file. Please try again.");
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleManualAdd = (emailOverride) => {
    const email = (emailOverride ?? manualEmail).trim().toLowerCase();
    if (!email) return;

    if (!EMAIL_PATTERN.test(email)) {
      showFeedback("error", "Enter a valid email address.");
      return;
    }

    if (excludedSet.has(email)) {
      showFeedback("error", excludedEmailMessage);
      return;
    }

    if (emails.some((existing) => existing.toLowerCase() === email)) {
      showFeedback("info", "This email is already in the list.");
      return;
    }

    onChange([...emails, email]);
    setManualEmail("");
    setSuggestions([]);
    showFeedback("success", `${labelTitle} added.`);
  };

  const handleRemoveAll = () => {
    if (!allowRemove || !emails.length || disabled) return;
    onRemoveAll?.();
  };

  const loadSuggestions = useCallback(async (query) => {
    if (!enableUserSuggestions || !query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const blocked = new Set(
      (excludedEmails || []).map((email) => String(email).trim().toLowerCase()).filter(Boolean)
    );

    setSearching(true);
    try {
      const results = await userApi.searchUsers(query.trim());
      const filtered = (results || []).filter((user) => {
        const candidate = String(user.email || "").toLowerCase();
        return (
          !emails.some((existing) => existing.toLowerCase() === candidate) &&
          !blocked.has(candidate)
        );
      });
      setSuggestions(filtered.slice(0, 8));
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }, [emails, enableUserSuggestions, excludedEmails]);

  useEffect(() => {
    if (!enableUserSuggestions) return undefined;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      loadSuggestions(manualEmail);
    }, 250);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [manualEmail, loadSuggestions, enableUserSuggestions]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-dusk">
          <FiUsers className="h-4 w-4 text-brand" />
          <span>
            <span className="font-semibold text-ink">{emails.length}</span> {entityLabel}
            {emails.length === 1 ? "" : "s"} in list
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-dark text-paper text-sm font-medium hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FiUpload className="h-4 w-4" />
            Import CSV / TXT
          </button>
          {allowRemove && emails.length > 0 && (
            <button
              type="button"
              disabled={disabled}
              onClick={handleRemoveAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-ember/30 text-ember text-sm font-medium hover:bg-ember-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FiTrash2 className="h-4 w-4" />
              Remove All
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        onChange={handleFileUpload}
        className="hidden"
        disabled={disabled}
      />

      {showManualAdd && (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1" ref={suggestionsRef}>
            <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dusk" />
            <input
              type="email"
              value={manualEmail}
              disabled={disabled}
              onChange={(e) => setManualEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (suggestions.length > 0) {
                    handleManualAdd(suggestions[0].email);
                  } else {
                    handleManualAdd();
                  }
                }
              }}
              placeholder={`Add ${entityLabel} email manually`}
              className="w-full pl-10 pr-3 py-2.5 border border-ink/15 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand disabled:bg-frost"
            />
            {enableUserSuggestions && (suggestions.length > 0 || searching) && manualEmail.trim().length >= 2 && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-ink/10 bg-paper shadow-lg max-h-52 overflow-y-auto">
                {searching && suggestions.length === 0 && (
                  <div className="px-3 py-2 text-xs text-dusk">Searching users…</div>
                )}
                {suggestions.map((user) => (
                  <button
                    key={user.email}
                    type="button"
                    onClick={() => handleManualAdd(user.email)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-glacier"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-glacier text-brand-dark">
                      <FiUser className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{user.email}</p>
                      <p className="text-xs text-dusk capitalize">{user.source || 'user'} account</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={disabled || !manualEmail.trim()}
            onClick={() => handleManualAdd()}
            className="px-4 py-2.5 rounded-lg bg-deep text-paper text-sm font-medium hover:bg-ink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add {labelTitle}
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-lg px-3 py-2 text-sm border ${
            feedback.type === "success"
              ? "bg-sage-soft border-aurora/30 text-aurora-muted"
              : feedback.type === "error"
              ? "bg-ember-soft border-ember/30 text-ember"
              : "bg-glacier border-brand/20 text-ink"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div
        className={`rounded-xl border border-ink/10 bg-frost/80 overflow-y-auto ${maxHeightClass} min-h-[140px]`}
      >
        {emails.length === 0 ? (
          <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center px-6 py-8 text-dusk">
            <FiUsers className="h-8 w-8 mb-2 text-dusk-soft" />
            <p className="text-sm">{emptyMessage}</p>
            <p className="text-xs mt-1 text-dusk">
              Import a CSV/TXT file or add emails one at a time. Start typing to see suggestions.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-ink/10">
            {emails.map((email) => (
              <li
                key={email}
                className="flex items-center justify-between gap-3 px-4 py-3 bg-paper hover:bg-glacier/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-dark to-brand-dark text-paper flex items-center justify-center text-xs font-semibold flex-shrink-0">
                    {email.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-ink truncate font-medium">{email}</span>
                </div>
                {allowRemove && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRemove(email)}
                    className="flex-shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-full text-dusk hover:text-ember hover:bg-ember-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label={`Remove ${email}`}
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-dusk">
        CSV and TXT imports add to the current list. Type at least 2 characters to search registered and authorized users.
      </p>
    </div>
  );
}

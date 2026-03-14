import React, { useEffect, useMemo, useRef } from "react";

export default function OtpInput({
  value = "",
  onChange,
  onComplete,
  disabled = false,
}) {
  const inputRefs = useRef([]);

  const digits = useMemo(() => {
    const sanitized = (value || "").replace(/\D/g, "").slice(0, 6);
    return Array.from({ length: 6 }, (_, i) => sanitized[i] || "");
  }, [value]);

  useEffect(() => {
    if (!disabled && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [disabled]);

  const updateAtIndex = (index, char) => {
    const next = [...digits];
    next[index] = char;
    const joined = next.join("");
    onChange?.(joined);

    if (next.every((d) => d !== "")) {
      onComplete?.(joined);
    }
  };

  const handleChange = (index, raw) => {
    if (disabled) return;
    const char = raw.replace(/\D/g, "").slice(-1);
    updateAtIndex(index, char);

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (disabled) return;

    if (event.key === "Backspace") {
      if (digits[index]) {
        updateAtIndex(index, "");
        return;
      }

      if (index > 0) {
        event.preventDefault();
        updateAtIndex(index - 1, "");
        inputRefs.current[index - 1]?.focus();
      }
    }

    if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    if (disabled) return;

    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length !== 6) return;

    event.preventDefault();
    onChange?.(pasted);
    onComplete?.(pasted);
    inputRefs.current[5]?.focus();
  };

  return (
    <div className="flex items-center justify-center gap-2" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength="1"
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          className="h-12 w-12 rounded-lg border border-gray-300 text-center text-xl font-semibold text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100"
        />
      ))}
    </div>
  );
}

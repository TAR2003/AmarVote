#!/usr/bin/env python3
"""Remove System.out.println(...) statements from Java sources (multi-line aware)."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JAVA_ROOT = ROOT / "backend" / "src" / "main" / "java"

MARKER = "System.out.println"


def _skip_java_string(s: str, i: int, quote: str) -> int:
    i += 1
    n = len(s)
    while i < n:
        c = s[i]
        if c == "\\" and i + 1 < n:
            i += 2
            continue
        if c == quote:
            return i + 1
        i += 1
    return n


def _find_println_statement_end(s: str, marker_start: int) -> int | None:
    """Return index after the closing `);` of println starting at marker_start, or None."""
    j = marker_start + len(MARKER)
    n = len(s)
    while j < n and s[j] in " \t":
        j += 1
    if j >= n or s[j] != "(":
        return None

    depth = 1
    i = j + 1
    while i < n:
        c = s[i]
        if c == '"':
            i = _skip_java_string(s, i, '"')
            continue
        if c == "'":
            i = _skip_java_string(s, i, "'")
            continue
        if c == "/" and i + 1 < n:
            if s[i + 1] == "/":
                nl = s.find("\n", i)
                i = n if nl == -1 else nl + 1
                continue
            if s[i + 1] == "*":
                end = s.find("*/", i + 2)
                i = n if end == -1 else end + 2
                continue
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                k = i + 1
                while k < n and s[k] in " \t":
                    k += 1
                if k < n and s[k] == ";":
                    k += 1
                if k < n and s[k] == "\r":
                    k += 1
                if k < n and s[k] == "\n":
                    k += 1
                return k
        i += 1
    return None


def _line_comment_before_println(s: str, marker_start: int) -> bool:
    line_start = s.rfind("\n", 0, marker_start) + 1
    segment = s[line_start:marker_start]
    slash = segment.find("//")
    if slash == -1:
        return False
    before_comment = segment[:slash]
    return before_comment.strip() == ""


def _statement_line_start(s: str, marker_start: int) -> int:
    line_start = s.rfind("\n", 0, marker_start) + 1
    before = s[line_start:marker_start]
    if before.strip() == "":
        return line_start
    return marker_start


def remove_println_statements(text: str) -> tuple[str, int, int]:
    """Returns (new_text, statements_removed, lines_removed)."""
    out: list[str] = []
    i = 0
    statements_removed = 0
    lines_removed = 0
    n = len(text)

    while i < n:
        idx = text.find(MARKER, i)
        if idx == -1:
            out.append(text[i:])
            break

        if _line_comment_before_println(text, idx):
            out.append(text[i : idx + len(MARKER)])
            i = idx + len(MARKER)
            continue

        stmt_start = _statement_line_start(text, idx)
        end = _find_println_statement_end(text, idx)
        if end is None:
            out.append(text[i : idx + len(MARKER)])
            i = idx + len(MARKER)
            continue

        out.append(text[i:stmt_start])
        lines_removed += text[stmt_start:end].count("\n")
        statements_removed += 1
        i = end

    return "".join(out), statements_removed, lines_removed


def process_file(path: Path) -> tuple[bool, int, int]:
    original = path.read_text(encoding="utf-8")
    new_text, stmts, lines = remove_println_statements(original)
    if new_text == original:
        return False, 0, 0
    path.write_text(new_text, encoding="utf-8", newline="")
    # Preserve original newline style: rewrite with same endings if needed
    if "\r\n" in original and "\r\n" not in new_text:
        path.write_text(new_text.replace("\n", "\r\n"), encoding="utf-8")
    elif "\r\n" not in original and "\r\n" in new_text:
        path.write_text(new_text.replace("\r\n", "\n"), encoding="utf-8")
    return True, stmts, lines


def main() -> int:
    if not JAVA_ROOT.is_dir():
        print(f"Java root not found: {JAVA_ROOT}", file=sys.stderr)
        return 1

    files_modified: list[str] = []
    total_statements = 0
    total_lines = 0

    for path in sorted(JAVA_ROOT.rglob("*.java")):
        changed, stmts, lines = process_file(path)
        if changed:
            rel = path.relative_to(ROOT)
            files_modified.append(str(rel))
            total_statements += stmts
            total_lines += lines
            print(f"  modified: {rel} (-{stmts} println, ~{lines} line(s))")

    print()
    print("Summary")
    print("-------")
    print(f"Files scanned:     {sum(1 for _ in JAVA_ROOT.rglob('*.java'))}")
    print(f"Files modified:    {len(files_modified)}")
    print(f"Println removed:   {total_statements}")
    print(f"Lines removed:     {total_lines}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

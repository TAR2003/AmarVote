# Guardian Email File Format

This document explains how to format CSV or TXT files for uploading guardian emails in the Create Election page.

## File Formats Supported

- `.txt` (Plain Text)
- `.csv` (Comma-Separated Values)

## Format Examples

### Option 1: One Email Per Line (TXT)

```
guardian1@example.com
guardian2@example.com
guardian3@example.com
guardian4@example.com
guardian5@example.com
```

### Option 2: Comma-Separated (CSV)

```
guardian1@example.com,guardian2@example.com,guardian3@example.com
guardian4@example.com,guardian5@example.com
```

### Option 3: Mixed Format

```
guardian1@example.com, guardian2@example.com
guardian3@example.com
guardian4@example.com, guardian5@example.com, guardian6@example.com
```

## Features

- **Automatic Deduplication**: Duplicate emails are automatically removed
- **Email Validation**: Invalid emails are skipped with a notification
- **Auto-Configuration**: 
  - Guardian count is set to the number of valid emails
  - Quorum is automatically set to more than half (e.g., 5 guardians → quorum of 3)
- **Maximum Limit**: Up to 20 guardians allowed

## What Happens After Upload

1. File is parsed and emails are extracted
2. Invalid emails are filtered out
3. Duplicates are removed
4. Guardian count is set automatically
5. Quorum is set to `floor(guardians/2) + 1` (more than half)
6. Success message shows how many emails were loaded

## Example

If you upload a file with:
```
alice@company.com
bob@company.com
charlie@company.com
alice@company.com
invalid-email
dave@company.com
eve@company.com
```

Result:
- ✅ 5 valid guardian emails loaded (alice, bob, charlie, dave, eve)
- ⚠️ 1 invalid email skipped
- ⚠️ 1 duplicate removed
- 🔢 Guardian count: 5
- 🔐 Quorum: 3 (more than half)

## Tips

- Start with fewer guardians for testing (3-5)
- For production elections, 5-10 guardians provide good security
- Ensure all guardian emails are valid and accessible
- Guardians will receive decryption credentials via these emails

---
name: google
description: Google Suite CLI (Gmail, Calendar, Drive, Contacts, Tasks, Sheets)
---

## Account Handling

| Task | Command |
|------|---------|
| List accounts | `gog auth list` |

**Important:**
- If a command fails with "missing --account", first run `gog auth list` to see available accounts
- Use `--account <email>` flag to specify which account to use (e.g., `gog gmail search 'newer_than:7d' --account user@gmail.com`)
- **NEVER use `gog auth manage`** - it opens a browser interactively

## Gmail

| Task | Command |
|------|---------|
| Search emails | `gog gmail search 'newer_than:7d' --max 10` |
| Read thread | `gog gmail thread get <threadId>` |
| Send email | `gog gmail send --to a@b.com --subject "Hi" --body "Hello"` |
| Send with HTML | `gog gmail send --to a@b.com --subject "Hi" --body-html "<p>Hello</p>"` |
| List labels | `gog gmail labels list` |
| List drafts | `gog gmail drafts list` |

## Calendar

| Task | Command |
|------|---------|
| Today's events | `gog calendar events primary --today` |
| Tomorrow | `gog calendar events primary --tomorrow` |
| This week | `gog calendar events primary --week` |
| Next N days | `gog calendar events primary --days 3` |
| Create event | `gog calendar create primary --summary "Meeting" --from 2025-01-15T10:00:00Z --to 2025-01-15T11:00:00Z` |
| Create with attendees | `gog calendar create primary --summary "Sync" --from ... --to ... --attendees "a@b.com,c@d.com"` |
| Respond to invite | `gog calendar respond primary <eventId> --status accepted` |
| Free/busy | `gog calendar freebusy --calendars "primary" --from ... --to ...` |

## Drive

| Task | Command |
|------|---------|
| List files | `gog drive list` |
| Search files | `gog drive search "report"` |
| Download file | `gog drive download <fileId>` |
| Upload file | `gog drive upload ./file.pdf` |
| Upload to folder | `gog drive upload ./file.pdf --parent <folderId>` |

## Contacts

| Task | Command |
|------|---------|
| Search contacts | `gog contacts search "john"` |
| Create contact | `gog contacts create --name "John Doe" --email "john@example.com"` |

## Tasks

| Task | Command |
|------|---------|
| List task lists | `gog tasks lists` |
| List tasks | `gog tasks list <tasklistId>` |
| Add task | `gog tasks add <tasklistId> --title "Do something"` |
| Complete task | `gog tasks done <tasklistId> <taskId>` |

## Sheets

| Task | Command |
|------|---------|
| Read sheet | `gog sheets read <spreadsheetId>` |
| Read range | `gog sheets read <spreadsheetId> --range "Sheet1!A1:B10"` |
| Write cells | `gog sheets write <spreadsheetId> --range "A1" --values "Hello,World"` |
| List tabs | `gog sheets tabs <spreadsheetId>` |

## Decrypting PDF Attachments

Some email attachments (e.g., bank statements) are password-protected. Use `qpdf` to decrypt:

| Task | Command |
|------|---------|
| Decrypt PDF | `qpdf --password=PASSWORD --decrypt input.pdf output.pdf` |

**Example:**
```bash
qpdf --password=mysecretpassword --decrypt statement.pdf statement_decrypted.pdf
```

## When to use me

Use this skill when the user wants to interact with Google services (Gmail, Calendar, Drive, Contacts, Tasks, Sheets) from the CLI.

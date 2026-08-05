---
name: email
description: CLI client for Outlook/Hotmail email and Google Suite (Gmail, Calendar, Drive, Contacts, Tasks, Sheets)
---

## Outlook / Hotmail (`himalaya`)

### Proxy

The backend is live IMAP through local OAuth2 `emailproxy`, not a cached maildir. Start it in the foreground:

```bash
emailproxy --config-file /Users/ice/.config/emailproxy/emailproxy.config --debug
```

Restart after timeouts or connection failures:

```bash
pkill -f emailproxy
emailproxy --config-file /Users/ice/.config/emailproxy/emailproxy.config --debug
```

### Search

This mailbox has 173 folders. `himalaya` v1.2.0 searches exactly one folder per invocation; there is no all-folder search, `himalaya search`, or `account sync`.

Each live IMAP invocation costs ~2.5–3.5 s in connection/auth overhead regardless of query. Never loop over all folders (~10 min).

List folders:

```bash
himalaya folder list --output json
```

Search the dedicated/likely folder first (~5 s), then stop on a match:

```bash
himalaya envelope list --folder "Inbox/WebAfrica" --page-size 20 --output json \
  'from webafrica or subject Webafrica order by date desc'
```

Otherwise search `INBOX`, `Sent`, and `Archive` in parallel (~4.7 s):

```bash
printf '%s\0' INBOX Sent Archive | xargs -0 -P 4 -I{} sh -c \
  'printf "\n=== %s ===\n" "$1"; himalaya envelope list --folder "$1" --page-size 20 --output json "from webafrica or subject Webafrica order by date desc"' _ '{}'
```

Cap parallelism at 4: measured 4 concurrent at 4.85 s; 8 regressed to 6.42 s. Keep `--page-size 20`; `1000` adds fetch/output with no search speedup.

Header search is preferred for precision, not speed. Outlook body search is well indexed (2.25–2.74 s):

```bash
himalaya envelope list --folder INBOX --page-size 20 --output json \
  'body WHMIG-3191 order by date desc'

himalaya envelope list --folder Sent --page-size 20 --output json \
  'to someone@example.com order by date desc'
```

Useful folders: `INBOX`, `Sent`, `Archive`, `Junk`, `Spambox`, `Deleted`, and sender folders such as `Inbox/WebAfrica`.

Future options: `mbsync` + `notmuch` local indexing is viable but not installed; Microsoft Graph `$search` needs new OAuth scopes.

### Read and attachments

IDs are mailbox-local and unstable: search by content, never reuse a recorded ID. Always read with `--preview` to preserve unread state:

```bash
himalaya message read --folder "<folder>" --preview <id>
himalaya attachment download --folder "<folder>" <id>
```

## Google Suite (`gog`)

### Auth

On `missing --account`, list accounts and pass one explicitly. Never run `gog auth manage`; it opens an interactive browser.

```bash
gog auth list
gog gmail search 'newer_than:7d' --max 10 --account user@gmail.com
```

### Commands

```bash
gog gmail thread get <threadId>
gog gmail send --to a@b.com --subject "Hi" --body "Hello"
gog calendar events primary --today
gog calendar create primary --summary "Meeting" --from 2026-08-05T10:00:00Z --to 2026-08-05T11:00:00Z
gog drive search "report"
gog drive download <fileId>
gog contacts search "john"
gog tasks list <tasklistId>
gog sheets read <spreadsheetId> --range "Sheet1!A1:B10"
```

## PDF attachments

Decrypt a password-protected PDF without recording the real password in this file:

```bash
qpdf --password=PASSWORD --decrypt input.pdf output.pdf
```

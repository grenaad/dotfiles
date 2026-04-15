---
name: email
description: CLI email client for Outlook/Hotmail
---

## Prerequisites

Start the proxy first (runs in foreground):

```bash
emailproxy
```

**Check if proxy is already running:**
```bash
ps aux | grep emailproxy | grep -v grep
```

**If himalaya commands timeout**, kill and restart the proxy:
```bash
pkill -f emailproxy
emailproxy
```

## Common Commands

| Task | Command |
|------|---------|
| List emails | `himalaya envelope list` |
| List more | `himalaya envelope list --page-size 50` |
| Read email | `himalaya message read <id>` |
| Download attachments | `himalaya attachment download <id>` |
| List folders | `himalaya folder list` |
| List folder emails | `himalaya envelope list --folder "Sent"` |

## Decrypting PDF Attachments

Some email attachments (e.g., bank statements) are password-protected. Use `qpdf` to decrypt:

| Task | Command |
|------|---------|
| Decrypt PDF | `qpdf --password=PASSWORD --decrypt input.pdf output.pdf` |

**Example:**
```bash
qpdf --password=mysecretpassword --decrypt statement.pdf statement_decrypted.pdf
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Commands timeout | Kill and restart proxy: `pkill -f emailproxy && emailproxy` |
| Connection refused | Start the proxy: `emailproxy` |
| Config not found | Proxy must use `--config-file ~/.config/emailproxy/emailproxy.config` (handled by alias) |

## When to use me

Use this skill when the user wants to check, read, or search their Hotmail/Outlook email from the CLI.

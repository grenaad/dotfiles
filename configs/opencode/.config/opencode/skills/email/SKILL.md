---
name: email
description: CLI email client for Outlook/Hotmail
---

## Prerequisites

Start the proxy first:

```bash
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

## When to use me

Use this skill when the user wants to check, read, or search their Hotmail/Outlook email from the CLI.

---
name: outlook
description: CLI client for Outlook/Hotmail email via himalaya and email-oauth2-proxy. Use to list, search, read, and download attachments from an Outlook/Hotmail account from the terminal.
---

# Outlook / Hotmail (himalaya)

Himalaya is the email client; it speaks plain IMAP/SMTP to a local
`emailproxy` (email-oauth2-proxy) which handles the Microsoft OAuth2 flow and
proxies through to Outlook. The proxy must be running before any himalaya
command will work.

## Prerequisites

Start the proxy headless (the `--no-gui` flag avoids the tray UI and is required
for CLI/agent use):

```bash
emailproxy --no-gui
```

The `emailproxy` alias already passes `--config-file ~/.config/emailproxy/emailproxy.config`.
Without the alias, run it in full:

```bash
emailproxy --config-file ~/.config/emailproxy/emailproxy.config --no-gui
```

**Check if the proxy is already running:**

```bash
ps aux | grep emailproxy | grep -v grep
```

**If himalaya commands hang or time out**, restart the proxy:

```bash
pkill -f emailproxy && emailproxy --no-gui
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

### Folder names

This mailbox uses these top-level folders (case-sensitive): `INBOX`, `Sent`,
`Drafts`, `Junk`, `Archive`, `Trash`. Sub-folders are nested with `/`, e.g.
`Inbox/FocalData`, `Inbox/Standard Bank`. Run `himalaya folder list` for the
full tree.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Commands time out | Kill and restart the proxy: `pkill -f emailproxy && emailproxy --no-gui` |
| Connection refused | Proxy is not running: `emailproxy --no-gui` |
| Tray UI / GUI appears | Always start with `--no-gui` for headless/CLI use |
| Config not found | Proxy must use `--config-file ~/.config/emailproxy/emailproxy.config` (handled by the alias) |

## Decrypting PDF Attachments

Some attachments (e.g. bank statements) are password-protected. Use `qpdf` to
decrypt:

```bash
qpdf --password=PASSWORD --decrypt input.pdf output.pdf
```

## When to use me

Use this skill when the user wants to check, read, search, or download
attachments from their Hotmail/Outlook email from the CLI. For Gmail and other
Google services, use the `gmcli` / `gccli` / `gdcli` skills instead.

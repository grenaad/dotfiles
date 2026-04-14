# Himalaya Email Setup

CLI email client for personal Outlook.com/Hotmail using email-oauth2-proxy for OAuth2 authentication.

## Architecture

```
┌─────────────┐   localhost    ┌──────────────────┐   OAuth2 + TLS   ┌─────────────────┐
│  Himalaya   │ ─────────────▶ │ email-oauth2-    │ ───────────────▶ │ outlook.office  │
│  CLI        │  :1993/:1587   │ proxy            │                  │ 365.com         │
└─────────────┘                └──────────────────┘                  └─────────────────┘
```

Himalaya connects to a local proxy which handles OAuth2 authentication to Microsoft servers.

## Configuration Files

### config.toml (Himalaya)

Connects to **local proxy** instead of Microsoft directly:

- `host = "127.0.0.1"` - localhost proxy
- `port = 1993` (IMAP) / `1587` (SMTP)
- `encryption.type = "none"` - proxy handles SSL
- Simple password auth (proxy handles real OAuth2)

### emailproxy.config (email-oauth2-proxy)

Handles OAuth2 authentication to Microsoft:

- Listens on localhost ports 1993/1587
- Uses `/consumers/` tenant (required for personal accounts)
- No client_secret (public client)
- Stores encrypted OAuth tokens (auto-refreshed)

## Installation

```bash
cd ~/projects/dotfiles
make himalaya   # prompts for vault password
```

This installs:

- `pipx` (via homebrew)
- `email-oauth2-proxy` (via pipx)
- `himalaya` (via cargo with oauth2 feature)

And deploys configs to:

- `~/.config/himalaya/config.toml`
- `~/.config/emailproxy/emailproxy.config`

## Usage

```bash
# Start proxy (required for Himalaya to work)
emailproxy

# Use Himalaya
himalaya envelope list
himalaya envelope list --page-size 50
himalaya message read <id>
himalaya attachment download <id>
himalaya folder list
```

### Auto-start proxy at login

Click menu bar icon → "Start at login"

## Editing Encrypted Configs

```bash
cd ~/projects/dotfiles/ansible/himalaya
ansible-vault edit config.toml
ansible-vault edit emailproxy.config
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot find configuration" | Ensure `XDG_CONFIG_HOME=~/.config` is set, or run `make himalaya` |
| Connection refused | Start the proxy: `emailproxy` |
| Authentication failed | Re-authorize via proxy menu bar → Authorize account |
| Token expired | Proxy auto-refreshes; if issues persist, re-authorize |

## Why This Setup?

Himalaya's built-in OAuth2 doesn't work with personal Microsoft accounts due to:

1. Token exchange bug in Himalaya
2. Personal accounts require public client (no client_secret)
3. Personal accounts need `/consumers/` tenant, not `/common/`

The email-oauth2-proxy handles OAuth2 externally, letting Himalaya use simple password auth.

## References

- [Himalaya](https://github.com/pimalaya/himalaya)
- [email-oauth2-proxy](https://github.com/simonrob/email-oauth2-proxy)
- [Microsoft OAuth for IMAP/SMTP](https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth)

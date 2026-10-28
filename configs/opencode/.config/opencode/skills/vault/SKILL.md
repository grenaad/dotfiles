---
name: vault
description: Use when reading, writing, or listing secrets in Focaldata's HashiCorp Vault (vault.focaldata.dev / vault.focaldata.com), when authenticating the vault CLI with GitHub, or when debugging vault "permission denied" / VAULT_TOKEN / VAULT_ADDR problems. Covers vault login, kv get/put/list, and secret paths like secret/dev/<project>.
---

# Focaldata Vault CLI

## Prerequisites

- `vault` CLI installed (`brew install vault`)
- `jq` installed (used by the helper script and for filtering JSON output)
- `$GITHUB_TOKEN` set to a GitHub personal access token (`ghp_…`). It is used **only to log in**.
- `VAULT_ADDR` and `VAULT_TOKEN` are deliberately **not** exported globally (they are commented out in `~/.env`). Set `VAULT_ADDR` inline on each command and let the CLI read the token from `~/.vault-token`.

## How tokens work

There are two different tokens. Don't mix them up.

| Token        | Looks like                        | Where it lives                              | Used for                                       |
| ------------ | --------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| GitHub PAT   | `ghp_…`                           | `$GITHUB_TOKEN`                             | Logging in only (`vault login -method=github`) |
| Vault token  | `s.…` (newer servers use `hvs.…`) | `~/.vault-token`, written by `vault login`  | Every other vault command                      |

- `vault login -method=github token=$GITHUB_TOKEN` sends the GitHub token to Vault. Vault returns its own token, and the CLI saves it to `~/.vault-token`.
- Vault tokens expire. The dev GitHub login currently issues renewable tokens that last about a month. When it expires, log in again.
- The CLI uses `$VAULT_TOKEN` if it is set, and `~/.vault-token` otherwise.
- **Never set `VAULT_TOKEN` to the GitHub token.** Vault rejects a `ghp_…` value with `403 permission denied`.
- **Never hard-code a Vault token** in `~/.env` or shell rc files either, because it expires. If a tool needs `VAULT_TOKEN` in its environment, pass it for that one command: `VAULT_TOKEN=$(cat ~/.vault-token) some-tool`.

## Connecting

Vault addresses:

| Environment | URL                                | Secret path prefix      |
| ----------- | ---------------------------------- | ----------------------- |
| Dev         | `https://vault.focaldata.dev:8200` | `secret/dev/<project>`  |
| Prod        | `https://vault.focaldata.com:8200` | `secret/prod/<project>` |

`VAULT_ADDR` is not set globally, so every command below sets it inline. Swap the URL to target prod. Without `VAULT_ADDR`, the CLI tries `https://127.0.0.1:8200` and fails with `connection refused`.

Every command is also prefixed with `unset VAULT_TOKEN &&`. Keep this prefix even though `VAULT_TOKEN` is no longer exported in `~/.env`. Long-running processes such as old terminals or the OpenCode background service can still carry a stale value, and it would override `~/.vault-token`.

## Authentication

Check whether you're already authenticated before logging in:

```bash
unset VAULT_TOKEN && VAULT_ADDR=https://vault.focaldata.dev:8200 vault token lookup
```

To see only when the current token expires:

```bash
unset VAULT_TOKEN && VAULT_ADDR=https://vault.focaldata.dev:8200 vault token lookup -format=json | jq -r .data.expire_time
```

If that fails, or any command returns `403 permission denied`, log in with the GitHub auth method:

```bash
unset VAULT_TOKEN && VAULT_ADDR=https://vault.focaldata.dev:8200 vault login -method=github token=$GITHUB_TOKEN
```

The CLI caches the resulting Vault token in `~/.vault-token` and uses it for later commands. `~/.vault-token` holds one token at a time, so logging in to prod replaces the dev token and the other way round. Log in again whenever you switch between dev and prod.

## Handling secret values

Anything a command prints ends up in terminal scrollback and in agent transcripts.

- To see what a secret contains, list **key names only**:

  ```bash
  unset VAULT_TOKEN && VAULT_ADDR=https://vault.focaldata.dev:8200 vault kv get -format=json secret/dev/fd-forge | jq -r '.data.data | keys[]'
  ```

- Print a value only when the user asks for it, and use `-field=KEY` so only that one value is printed.
- To load values into environment variables without printing them:

  ```bash
  unset VAULT_TOKEN
  eval "$(VAULT_ADDR=https://vault.focaldata.dev:8200 vault kv get -format=json secret/dev/fd-codeforge \
    | jq -r '.data.data | to_entries[] | select(.key | test("^FD_APP_")) | "export \(.key)=\(.value | @sh)"')"
  ```

- To check whether `VAULT_TOKEN` is set, don't run `env | grep VAULT_TOKEN`, because that prints the token. Use `[ -n "$VAULT_TOKEN" ] && echo "VAULT_TOKEN set: ${VAULT_TOKEN:0:4}…"` instead.

## Common Operations

Secrets are stored under the KV v2 engine at `secret/`.

**List available secret paths:**

```bash
unset VAULT_TOKEN && VAULT_ADDR=https://vault.focaldata.dev:8200 vault kv list secret/dev/
```

**Read all secrets for a project** (prints values; see "Handling secret values"):

```bash
unset VAULT_TOKEN && VAULT_ADDR=https://vault.focaldata.dev:8200 vault kv get secret/dev/fd-forge
```

**Read a single field:**

```bash
unset VAULT_TOKEN && VAULT_ADDR=https://vault.focaldata.dev:8200 vault kv get -field=QUESTIONNAIRE_ENDPOINT secret/dev/fd-core-respondent
```

**Add, update, or remove individual keys (safe — preserves other keys):**

Use the bundled helper script. It reads the secret, merges your change, and writes it back with check-and-set, so it never clobbers keys you didn't touch. Paths are relative to this skill's directory.

```bash
# add or update keys
./scripts/vault-kv-edit.sh dev secret/dev/fd-forge set NEW_KEY=value OTHER_KEY=thing

# remove keys
./scripts/vault-kv-edit.sh dev secret/dev/fd-forge rm OLD_KEY

# dump current keys/values as JSON (prints values)
./scripts/vault-kv-edit.sh dev secret/dev/fd-forge get
```

The first argument is `dev` or `prod`, and the script sets `VAULT_ADDR` from it. It also unsets `VAULT_TOKEN` itself. `set` and `rm` report key names only; `get` prints values. Requires `jq`.

**Create a NEW secret (replaces ALL keys at the path):**

```bash
unset VAULT_TOKEN && VAULT_ADDR=https://vault.focaldata.dev:8200 vault kv put secret/dev/fd-forge \
  KEY1=value1 \
  KEY2=value2
```

> **Warning:** `vault kv put` replaces the entire secret at that path — only use it to create a secret that doesn't exist yet. For modifying an existing secret, always use `scripts/vault-kv-edit.sh` above.

## Troubleshooting

- **`dial tcp 127.0.0.1:8200: connect: connection refused`**: `VAULT_ADDR` isn't set. Set it inline, as in the commands above.
- **`403 permission denied`**:
  1. Check whether `VAULT_TOKEN` is set, using the safe check under "Handling secret values". If it is set, it overrides `~/.vault-token`. A `ghp_…` value means the GitHub token was exported as `VAULT_TOKEN` by mistake. Unset it for the command, then remove the export from wherever it comes from (for example `~/.env`).
  2. Otherwise, the cached token has expired or was issued by the other Vault (dev vs prod). Log in again against the correct `VAULT_ADDR`.
- **A long-running process still has the old `VAULT_TOKEN`** after you fixed `~/.env`: environment variables are fixed when a process starts. Open a new terminal. For the OpenCode background service, run `opencode service restart` from a terminal that has the fixed environment.

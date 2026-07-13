---
name: vault
description: Use when reading, writing, or listing secrets in Focaldata's HashiCorp Vault (vault.focaldata.dev / vault.focaldata.com), or when authenticating the vault CLI with GitHub. Covers vault login, kv get/put/list, and secret paths like secret/dev/<project>.
---

# Focaldata Vault CLI

## Prerequisites

- `vault` CLI installed (`brew install vault`)
- `$GITHUB_TOKEN` environment variable set with a valid GitHub personal access token

## Connecting

Vault addresses:

| Environment | URL                                | Secret path prefix     |
| ----------- | ---------------------------------- | ---------------------- |
| Dev         | `https://vault.focaldata.dev:8200` | `secret/dev/<project>` |
| Prod        | `https://vault.focaldata.com:8200` | `secret/prod/<project>` |

Every command below sets `VAULT_ADDR` inline. Swap the URL to target prod.

**Always prefix commands with `unset VAULT_TOKEN &&`.** A stale `VAULT_TOKEN` env var shadows the cached token in `~/.vault-token` and causes confusing `permission denied` errors. Unsetting it forces the CLI to fall back to the cached file token.

## Authentication

Check whether you're already authenticated before logging in:

```bash
unset VAULT_TOKEN && VAULT_ADDR=https://vault.focaldata.dev:8200 vault token lookup
```

If that fails (or any command returns `403 permission denied`), log in with the GitHub auth method:

```bash
unset VAULT_TOKEN && VAULT_ADDR=https://vault.focaldata.dev:8200 vault login -method=github token=$GITHUB_TOKEN
```

The token is cached in `~/.vault-token` and used automatically for subsequent commands. Note: `~/.vault-token` holds one token at a time — switching between dev and prod requires logging in again against the other address.

## Common Operations

Secrets are stored under the KV v2 engine at `secret/`.

**List available secret paths:**

```bash
unset VAULT_TOKEN && VAULT_ADDR=https://vault.focaldata.dev:8200 vault kv list secret/dev/
```

**Read all secrets for a project:**

```bash
unset VAULT_TOKEN && VAULT_ADDR=https://vault.focaldata.dev:8200 vault kv get secret/dev/fd-forge
```

**Read a single field:**

```bash
unset VAULT_TOKEN && VAULT_ADDR=https://vault.focaldata.dev:8200 vault kv get -field=QUESTIONNAIRE_ENDPOINT secret/dev/fd-core-respondent
```

**Add, update, or remove individual keys (safe — preserves other keys):**

Use the bundled helper script. It does a read → merge → write with check-and-set, so it never clobbers keys you didn't touch. Paths are relative to this skill's directory.

```bash
# add or update keys
./scripts/vault-kv-edit.sh dev secret/dev/fd-forge set NEW_KEY=value OTHER_KEY=thing

# remove keys
./scripts/vault-kv-edit.sh dev secret/dev/fd-forge rm OLD_KEY

# dump current keys/values as JSON
./scripts/vault-kv-edit.sh dev secret/dev/fd-forge get
```

First argument is `dev` or `prod` (sets `VAULT_ADDR`); the script handles `unset VAULT_TOKEN` internally. Requires `jq`.

**Create a NEW secret (replaces ALL keys at the path):**

```bash
unset VAULT_TOKEN && VAULT_ADDR=https://vault.focaldata.dev:8200 vault kv put secret/dev/fd-forge \
  KEY1=value1 \
  KEY2=value2
```

> **Warning:** `vault kv put` replaces the entire secret at that path — only use it to create a secret that doesn't exist yet. For modifying an existing secret, always use `scripts/vault-kv-edit.sh` above.

## Troubleshooting

- `403 permission denied` → token expired or wrong vault; re-run the login command against the correct `VAULT_ADDR`.
- Commands mysteriously fail despite a recent login → check `env | grep VAULT_TOKEN`; a stale exported token overrides `~/.vault-token`.

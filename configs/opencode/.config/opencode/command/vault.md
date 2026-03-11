---
description: Using Vault CLI with Focaldata Vaults
---

### Prerequisites

- `vault` CLI installed (`brew install vault`)
- `$GITHUB_TOKEN` environment variable set with a valid GitHub personal access token

### Vault URLs

| Environment | URL                                |
| ----------- | ---------------------------------- |
| Dev         | `https://vault.focaldata.dev:8200` |
| Prod        | `https://vault.focaldata.com:8200` |

### Authentication

Authenticate using the GitHub auth method:

```bash
VAULT_ADDR=https://vault.focaldata.dev:8200 vault login -method=github token=$GITHUB_TOKEN
```

This returns a Vault token. Pass it as `VAULT_TOKEN` in subsequent commands, or let the CLI use the cached token from `~/.vault-token`.

### Common Operations

**List available secret paths:**

```bash
VAULT_ADDR=https://vault.focaldata.dev:8200 vault kv list secret/dev/
```

**Read all secrets for a project:**

```bash
VAULT_ADDR=https://vault.focaldata.dev:8200 vault kv get secret/dev/fd-forge
```

**Read a single field:**

```bash
VAULT_ADDR=https://vault.focaldata.dev:8200 vault kv get -field=QUESTIONNAIRE_ENDPOINT secret/dev/fd-core-respondent
```

**Write secrets (replaces ALL keys at the path):**

```bash
VAULT_ADDR=https://vault.focaldata.dev:8200 vault kv put secret/dev/fd-forge \
  KEY1=value1 \
  KEY2=value2
```

> **Warning:** `vault kv put` replaces the entire secret at that path. Always include all existing keys when adding new ones, or existing values will be lost. Read the current values first with `vault kv get` before writing.

### Secrets Structure

Secrets are stored under the KV v2 engine at `secret/` with paths following the pattern:

- Dev: `secret/dev/<project-name>`
- Prod: `secret/prod/<project-name>`

Each write bumps the version number. Previous versions are retained and can be accessed.

### Tips

- Use `VAULT_ADDR` and `VAULT_TOKEN` as env vars on each command, or export them for a session
- To inspect another project's config for reference (e.g. internal Kubernetes URLs), read their vault secrets: `vault kv get secret/dev/fd-core-respondent`
- Internal Kubernetes service URLs follow the pattern: `http://<service-name>.backend.svc.cluster.local:<port>`

$ARGUMENTS

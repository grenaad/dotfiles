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
unset VAULT_TOKEN && VAULT_ADDR=https://vault.focaldata.dev:8200 vault login -method=github token=$GITHUB_TOKEN
```

The token is cached in `~/.vault-token` and used automatically for subsequent commands.

### Common Operations

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

**Write secrets (replaces ALL keys at the path):**

```bash
unset VAULT_TOKEN && VAULT_ADDR=https://vault.focaldata.dev:8200 vault kv put secret/dev/fd-forge \
  KEY1=value1 \
  KEY2=value2
```

> **Warning:** `vault kv put` replaces the entire secret at that path. Always include all existing keys when adding new ones, or existing values will be lost. Read the current values first with `vault kv get` before writing.

### Secrets Structure

Secrets are stored under the KV v2 engine at `secret/` with paths following the pattern:

- Dev: `secret/dev/<project-name>`
- Prod: `secret/prod/<project-name>`

### Tips

- Always prefix commands with `unset VAULT_TOKEN &&` to ensure the cached GitHub token is used
- Internal Kubernetes service URLs follow the pattern: `http://<service-name>.backend.svc.cluster.local:<port>`

$ARGUMENTS

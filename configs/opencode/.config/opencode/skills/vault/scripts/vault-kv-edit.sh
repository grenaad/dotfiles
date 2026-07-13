#!/usr/bin/env bash
#
# vault-kv-edit.sh — safe key-level edits for Focaldata Vault KV v2 secrets.
#
# Unlike `vault kv put` (which replaces the ENTIRE secret at a path), this
# script does a client-side read -> merge -> write with check-and-set, so
# individual keys can be added, updated, or removed without clobbering the
# rest of the secret.
#
# Usage:
#   vault-kv-edit.sh <dev|prod> <secret-path> set KEY=VALUE [KEY=VALUE ...]
#   vault-kv-edit.sh <dev|prod> <secret-path> rm KEY [KEY ...]
#   vault-kv-edit.sh <dev|prod> <secret-path> get
#
# Examples:
#   vault-kv-edit.sh dev secret/dev/fd-forge set NEW_KEY=value OTHER=thing
#   vault-kv-edit.sh dev secret/dev/fd-forge rm OLD_KEY
#   vault-kv-edit.sh dev secret/dev/fd-forge get
#
# Requires: vault, jq

set -euo pipefail

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

die() {
  echo "error: $*" >&2
  exit 1
}

[ $# -ge 3 ] || usage

command -v vault >/dev/null 2>&1 || die "vault CLI not found (brew install vault)"
command -v jq >/dev/null 2>&1 || die "jq not found (brew install jq)"

ENV_NAME=$1
SECRET_PATH=$2
ACTION=$3
shift 3

case "$ENV_NAME" in
  dev) export VAULT_ADDR="https://vault.focaldata.dev:8200" ;;
  prod) export VAULT_ADDR="https://vault.focaldata.com:8200" ;;
  *) die "unknown environment '$ENV_NAME' (expected dev or prod)" ;;
esac

# A stale VAULT_TOKEN env var shadows the cached ~/.vault-token.
unset VAULT_TOKEN

# --- read current secret ---------------------------------------------------

if ! RAW_JSON=$(vault kv get -format=json "$SECRET_PATH" 2>&1); then
  echo "$RAW_JSON" >&2
  die "could not read '$SECRET_PATH'. If the secret does not exist yet, create it with:
  vault kv put $SECRET_PATH KEY=value
If you got 'permission denied', re-authenticate:
  vault login -method=github token=\$GITHUB_TOKEN"
fi

CURRENT=$(jq '.data.data' <<<"$RAW_JSON")
VERSION=$(jq -r '.data.metadata.version' <<<"$RAW_JSON")

# --- perform action --------------------------------------------------------

case "$ACTION" in
  get)
    jq -S . <<<"$CURRENT"
    exit 0
    ;;

  set)
    [ $# -ge 1 ] || die "set requires at least one KEY=VALUE pair"
    UPDATED=$CURRENT
    for PAIR in "$@"; do
      [[ $PAIR == *=* ]] || die "invalid pair '$PAIR' (expected KEY=VALUE)"
      KEY=${PAIR%%=*}
      VALUE=${PAIR#*=}
      [ -n "$KEY" ] || die "empty key in pair '$PAIR'"
      UPDATED=$(jq --arg k "$KEY" --arg v "$VALUE" '.[$k] = $v' <<<"$UPDATED")
    done
    ;;

  rm)
    [ $# -ge 1 ] || die "rm requires at least one KEY"
    UPDATED=$CURRENT
    for KEY in "$@"; do
      jq -e --arg k "$KEY" 'has($k)' <<<"$UPDATED" >/dev/null \
        || die "key '$KEY' does not exist at $SECRET_PATH (keys: $(jq -r 'keys | join(", ")' <<<"$UPDATED"))"
      UPDATED=$(jq --arg k "$KEY" 'del(.[$k])' <<<"$UPDATED")
    done
    ;;

  *)
    die "unknown action '$ACTION' (expected set, rm, or get)"
    ;;
esac

# --- write back with check-and-set -----------------------------------------

# -cas fails the write if the secret changed since we read it (version bump),
# so we never silently clobber a concurrent edit.
jq -c . <<<"$UPDATED" | vault kv put -cas="$VERSION" "$SECRET_PATH" - >/dev/null

# --- report (key names only; never print values) ----------------------------

echo "updated $SECRET_PATH (was v$VERSION) on $ENV_NAME"
BEFORE_KEYS=$(jq -r 'keys | sort | join(", ")' <<<"$CURRENT")
AFTER_KEYS=$(jq -r 'keys | sort | join(", ")' <<<"$UPDATED")
echo "keys before: $BEFORE_KEYS"
echo "keys after:  $AFTER_KEYS"

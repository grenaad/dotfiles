#!/bin/bash

# ── 1. Ensure uv is installed ──
if ! command -v uv &> /dev/null; then
  echo "Installing uv..." >&2
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

# ── 2. Ensure litellm is installed ──
if ! command -v litellm &> /dev/null; then
  echo "Installing litellm..." >&2
  uv pip install 'litellm[proxy]' --system
fi

# ── 3. Start LiteLLM proxy if not already running ──
if ! curl -s http://localhost:11434 > /dev/null 2>&1; then
  echo "Starting LiteLLM proxy..." >&2
  litellm --model gemini/gemini-3-flash --port 11434 &>/dev/null &
  LITELLM_PID=$!

  for i in {1..15}; do
    if curl -s http://localhost:11434 > /dev/null 2>&1; then
      echo "LiteLLM proxy ready." >&2
      break
    fi
    sleep 1
  done
fi

# ── 4. Hand off to Context+ ──
exec bunx contextplus

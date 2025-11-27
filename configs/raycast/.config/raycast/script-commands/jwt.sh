#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title FD JWT
# @raycast.mode compact

# Optional parameters:
# @raycast.icon 🤖

function jwt {
  cd ~/work/focaldata/fd-local/
  poetry run python src/main.py jwt
}


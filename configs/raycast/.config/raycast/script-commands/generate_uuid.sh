#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Generate UUID
# @raycast.mode silent

# Optional parameters:
# @raycast.icon ⇾

# Documentation:
# @raycast.description Generates a UUID and copies it to the clipboard
# @raycast.author Adam Higgins
# @raycast.authorURL https://github.com/adampeterhiggins

# Generate a lowercase UUID
UUID=$(uuidgen | tr 'A-Z' 'a-z')

# Copy it to the clipboard (macOS)
echo -n "$UUID" | pbcopy

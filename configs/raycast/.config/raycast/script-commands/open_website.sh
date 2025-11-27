#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Open website
# @raycast.mode silent

# Optional parameters:
# @raycast.icon ⇾

# Documentation:
# @raycast.description Prompts the user for a url and opens it in Zen
# @raycast.author Adam Higgins
# @raycast.authorURL https://github.com/adampeterhiggins
# @raycast.argument1 { "type": "text", "placeholder": "url", "optional": false}

URL="$1"

open -a Zen "$URL"
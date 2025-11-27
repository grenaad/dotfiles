#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Github code search
# @raycast.mode silent

# Optional parameters:
# @raycast.icon ⇾

# Documentation:
# @raycast.description Prompts the user for a search term and searches the focaldata codebase for it
# @raycast.author Adam Higgins
# @raycast.authorURL https://github.com/adampeterhiggins
# @raycast.argument1 { "type": "text", "placeholder": "search", "optional": false}

SEARCH="$1"
SEARCH_TERM=$(python3 -c "import urllib.parse; print(urllib.parse.quote_plus('org:focaldata $SEARCH'))")
URL="https://github.com/search?type=code&q=$SEARCH_TERM"
open -a Zen "$URL"
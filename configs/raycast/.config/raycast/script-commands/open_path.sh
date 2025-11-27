#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Go to path
# @raycast.mode silent

# Optional parameters:
# @raycast.icon ⇾

# Documentation:
# @raycast.description Prompts the user for a path an opens a finder window at that path
# @raycast.author Adam Higgins
# @raycast.authorURL https://github.com/adampeterhiggins
# @raycast.argument1 { "type": "text", "placeholder": "path", "optional": false}

PATH_="$1"


open -a Finder "$PATH_"
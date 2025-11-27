#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Open Jira Ticket
# @raycast.mode silent

# Optional parameters:
# @raycast.icon ⇾

# Documentation:
# @raycast.description Prompts the user for a ticker number and opens it in jira
# @raycast.author Adam Higgins
# @raycast.authorURL https://github.com/adampeterhiggins
# @raycast.argument1 { "type": "text", "placeholder": "ticket_number", "optional": true}

TICKET="$1"

if [[ ! "${TICKET}" == "" ]]; then
    TICKET_PATH="https://focaldata.atlassian.net/browse/CH-$TICKET";
else
    TICKET_PATH="https://focaldata.atlassian.net/jira/software/projects/CH/boards/22";
fi

open -a Zen "${TICKET_PATH}"
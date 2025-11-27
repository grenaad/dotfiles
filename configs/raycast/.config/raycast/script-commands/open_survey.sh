#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Open Focaldata survey
# @raycast.mode silent

# Optional parameters:
# @raycast.icon ⇾

# Documentation:
# @raycast.description Prompts the user for a survey id and opens it in Zen
# @raycast.author Adam Higgins
# @raycast.authorURL https://github.com/adampeterhiggins
# @raycast.argument1 { "type": "text", "placeholder": "survey_id", "optional": false}
# @raycast.argument2 { "type": "dropdown", "placeholder": "TYPE", "optional": true, "data": [{"title": "CORE", "value": "survey"},{"title": "CHAT", "value": "fdchat"}], "default": "CORE"}
# @raycast.argument3 { "type": "dropdown", "placeholder": "PAGE", "optional": true, "data": [{"title": "Results", "value": "results"},{"title": "Setup", "value": "setup"},{"title": "Questionnaire", "value": "questionnaire"},{"title": "Confirm", "value": "confirmation"},{"title":"Preview", "value": "preview"}], "default": "results"}

set -a  # Automatically export all variables

source .env

ENV="com"

SURVEY="$1"
TYPE="$2"
PAGE="$3"

if [ "$TYPE" = "fdchat" ]; then
    if [ "$PAGE" = "setup" ]; then
        SUFFIX="setup/objectives"
    fi
    if [ "$PAGE" = "questionnaire" ]; then
        SUFFIX="setup/audience"
    fi
    if [ "$PAGE" = "confirmation" ]; then
        SUFFIX="setup/review"
    fi
    if [ "$PAGE" = "results" ]; then
        SUFFIX="results/ask-ai"
    fi
fi

if [ "$TYPE" = "survey" ]; then
    if [ "$PAGE" = "setup" ]; then
        SUFFIX="audience"
    fi
    if [ "$PAGE" = "questionnaire" ]; then
        SUFFIX="questionnaire"
    fi
    if [ "$PAGE" = "confirmation" ]; then
        SUFFIX="confirm"
    fi
    if [ "$PAGE" = "results" ]; then
        SUFFIX="results"
    fi
fi

URL="https://$DASHBOARD.$ENV/$TYPE/$SURVEY/$SUFFIX"

if [ "$PAGE" = "preview" ]; then
    RID=$(uuidgen)
    URL="https://$PREVIEW_DASHBOARD.$ENV/questionnaire?sid=$SURVEY&ps=fd&type=$TYPE&preview=true&collect=false&rid=$rid"
fi

open -a Zen "$URL"
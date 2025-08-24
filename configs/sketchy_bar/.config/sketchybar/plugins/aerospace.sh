#!/usr/bin/env bash

source "$HOME/.config/sketchybar/variables.sh"

CURRENT=${FOCUSED_WORKSPACE:-$(aerospace list-workspaces --focused)}

WORKSPACE_NAME=${NAME#workspace.}

WORKSPACE_CLICK_SCRIPT="aerospace workspace $WORKSPACE_NAME"

if [ "$WORKSPACE_NAME" = "$CURRENT" ]; then
  sketchybar --animate tanh 5 --set "$NAME" \
    icon.color="$RED" \
    icon="$WORKSPACE_NAME" \
    click_script="$WORKSPACE_CLICK_SCRIPT"
else
  sketchybar --animate tanh 5 --set "$NAME" \
    icon.color="$COMMENT" \
    icon="$WORKSPACE_NAME" \
    click_script="$WORKSPACE_CLICK_SCRIPT"
fi
#!/bin/bash

source "$CONFIG_DIR/colors.sh" # Loads all defined colors

CURRENT=${FOCUSED_WORKSPACE:-$(aerospace list-workspaces --focused)}
WORKSPACE_NAME=${NAME#space.}

WORKSPACE_CLICK_SCRIPT="aerospace workspace $WORKSPACE_NAME"

if [ "$WORKSPACE_NAME" = "$CURRENT" ]; then
  sketchybar --set $NAME background.drawing=on \
                         background.color=$ACCENT_COLOR \
                         label.color=$BAR_COLOR \
                         icon.color=$BAR_COLOR \
                         click_script="$WORKSPACE_CLICK_SCRIPT"
else
  sketchybar --set $NAME background.drawing=off \
                         label.color=$ACCENT_COLOR \
                         icon.color=$ACCENT_COLOR \
                         click_script="$WORKSPACE_CLICK_SCRIPT"
fi
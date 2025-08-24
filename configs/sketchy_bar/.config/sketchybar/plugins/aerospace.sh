#!/usr/bin/env bash

source "$HOME/.config/sketchybar/variables.sh" # Loads all defined colors

CURRENT=${FOCUSED_WORKSPACE:-$(aerospace list-workspaces --focused)}

WORKSPACE_NAME=${NAME#workspace.}

WORKSPACE_CLICK_SCRIPT="aerospace workspace $WORKSPACE_NAME"

# Get workspace index for Chinese icon
WORKSPACES=($(aerospace list-workspaces --all))
for i in "${!WORKSPACES[@]}"; do
	if [[ "${WORKSPACES[$i]}" = "$WORKSPACE_NAME" ]]; then
		WORKSPACE_INDEX=$i
		break
	fi
done

if [ "$WORKSPACE_NAME" = "$CURRENT" ]; then
	sketchybar --animate tanh 5 --set "$NAME" \
		icon.color="$RED" \
		icon="${SPACE_ICONS[$WORKSPACE_INDEX]}" \
		click_script="$WORKSPACE_CLICK_SCRIPT"
else
	sketchybar --animate tanh 5 --set "$NAME" \
		icon.color="$COMMENT" \
		icon="${SPACE_ICONS[$WORKSPACE_INDEX]}" \
		click_script="$WORKSPACE_CLICK_SCRIPT"
fi
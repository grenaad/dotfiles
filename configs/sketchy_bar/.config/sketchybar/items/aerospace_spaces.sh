#!/usr/bin/env bash

source "$HOME/.config/sketchybar/variables.sh" # Loads all defined colors

sketchybar --add event aerospace_workspace_change

sketchybar --add item spacer.1 left \
	--set spacer.1 background.drawing=off \
	label.drawing=off \
	icon.drawing=off \
	width=10

WORKSPACES=$(aerospace list-workspaces --all)
WORKSPACE_INDEX=0

for WORKSPACE in $WORKSPACES; do
	sketchybar --add item "workspace.$WORKSPACE" left \
		--set "workspace.$WORKSPACE" \
		label.drawing=off \
		icon.padding_left=10 \
		icon.padding_right=10 \
		background.padding_left=-5 \
		background.padding_right=-5 \
		script="$PLUGIN_DIR/aerospace.sh" \
		--subscribe "workspace.$WORKSPACE" aerospace_workspace_change
	WORKSPACE_INDEX=$((WORKSPACE_INDEX + 1))
done

sketchybar --add item spacer.2 left \
	--set spacer.2 background.drawing=off \
	label.drawing=off \
	icon.drawing=off \
	width=5

sketchybar --add bracket workspaces '/workspace\..*/' \
	--set workspaces background.border_width="$BORDER_WIDTH" \
	background.border_color="$RED" \
	background.corner_radius="$CORNER_RADIUS" \
	background.color="$BAR_COLOR" \
	background.height=26 \
	background.drawing=on

sketchybar --add item separator left \
	--set separator icon= \
	icon.font="$FONT:Regular:16.0" \
	background.padding_left=26 \
	background.padding_right=15 \
	label.drawing=off \
	associated_display=active \
	icon.color="$YELLOW"
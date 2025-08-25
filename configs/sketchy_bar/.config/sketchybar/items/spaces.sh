#!/bin/bash

sketchybar --add event aerospace_workspace_change

WORKSPACES=$(aerospace list-workspaces --all)

for WORKSPACE in $WORKSPACES; do
  sketchybar --add space space.$WORKSPACE left                                 \
             --set space.$WORKSPACE space=$WORKSPACE                                 \
                              icon=$WORKSPACE                                  \
                              label.drawing=off                               \
                              script="$PLUGIN_DIR/aerospace.sh"              \
             --subscribe space.$WORKSPACE aerospace_workspace_change
done

sketchybar --add item space_separator left                             \
           --set space_separator icon="􀆊"                                \
                                 icon.color=$ACCENT_COLOR \
                                 icon.padding_left=4                   \
                                 label.drawing=off                     \
                                 background.drawing=off
#!/bin/sh

if [ "$SENDER" = "front_app_switched" ]; then
  ICON="$($CONFIG_DIR/plugins/icon_map_fn.sh "$INFO")"
  sketchybar --set $NAME icon="$ICON" label="$INFO"
fi
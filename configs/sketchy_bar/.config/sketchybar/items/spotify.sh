#!/usr/bin/env bash

source "$HOME/.config/sketchybar/variables.sh"

COLOR="$ORANGE"

sketchybar --add item spotify q \
 --set spotify \
       scroll_texts=on \
       icon=󰎆 \
       icon.color="$COLOR" \
       icon.padding_left=10 \
       icon.scroll_duration=0 \
       background.color="$BAR_COLOR" \
       background.height=26 \
       background.corner_radius="$CORNER_RADIUS" \
       background.border_width="$BORDER_WIDTH" \
       background.border_color="$COLOR" \
       background.padding_right=-5 \
       background.drawing=on \
       label.padding_right=10 \
       label.max_chars=20 \
       label.scroll_duration=0 \
       associated_display=active \
       updates=on \
       update_freq=2 \
       script="$PLUGIN_DIR/spotify.sh" \
 --subscribe spotify media_change


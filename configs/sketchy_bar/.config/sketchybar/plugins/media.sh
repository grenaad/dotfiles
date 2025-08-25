#!/bin/bash

# Try SketchyBar's built-in media events first
if [ -n "$INFO" ] && [ "$SENDER" = "media_change" ]; then
  STATE="$(echo "$INFO" | jq -r '.state')"
  if [ "$STATE" = "playing" ]; then
    MEDIA="$(echo "$INFO" | jq -r '.title + " - " + .artist')"
    sketchybar --set $NAME label="$MEDIA" drawing=on
    exit 0
  else
    sketchybar --set $NAME drawing=off
    exit 0
  fi
fi

# Fallback: Use AppleScript for reliable media detection
MEDIA=""

# Try Spotify first
if osascript -e 'tell application "Spotify" to return player state' 2>/dev/null | grep -q "playing"; then
  TITLE=$(osascript -e 'tell application "Spotify" to return name of current track' 2>/dev/null)
  ARTIST=$(osascript -e 'tell application "Spotify" to return artist of current track' 2>/dev/null)
  if [ -n "$TITLE" ] && [ -n "$ARTIST" ]; then
    MEDIA="$TITLE - $ARTIST"
  fi
fi

# Try Apple Music if Spotify didn't work
if [ -z "$MEDIA" ] && osascript -e 'tell application "Music" to return player state' 2>/dev/null | grep -q "playing"; then
  TITLE=$(osascript -e 'tell application "Music" to return name of current track' 2>/dev/null)
  ARTIST=$(osascript -e 'tell application "Music" to return artist of current track' 2>/dev/null)
  if [ -n "$TITLE" ] && [ -n "$ARTIST" ]; then
    MEDIA="$TITLE - $ARTIST"
  fi
fi

# Update display
if [ -n "$MEDIA" ]; then
  sketchybar --set $NAME label="$MEDIA" drawing=on
else
  sketchybar --set $NAME drawing=off
fi
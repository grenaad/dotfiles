#!/usr/bin/env bash

STATE_FILE="/tmp/sketchybar_spotify_state"

# Function to get Spotify info via AppleScript since media events aren't working
get_spotify_info() {
    osascript << EOF
try
    tell application "Spotify"
        if it is running then
            set trackName to name of current track
            set artistName to artist of current track
            set playerState to player state as string
            return trackName & "|" & artistName & "|" & playerState
        else
            return "not_running"
        end if
    end tell
on error
    return "error"
end try
EOF
}

# Try to get info from media events first, fallback to AppleScript
if [ -n "$INFO" ] && [ "$INFO" != "null" ]; then
    STATE="$(echo "$INFO" | jq -r '.state')"
    APP="$(echo "$INFO" | jq -r '.app')"
    if [ "$STATE" = "playing" ] && [ "$APP" = "Spotify" ]; then
        TRACK_NAME="$(echo "$INFO" | jq -r '.title')"
        ARTIST_NAME="$(echo "$INFO" | jq -r '.artist')"
        PLAYER_STATE="playing"
        SPOTIFY_INFO="$TRACK_NAME|$ARTIST_NAME|$PLAYER_STATE"
    elif [ "$STATE" = "paused" ] && [ "$APP" = "Spotify" ]; then
        TRACK_NAME="$(echo "$INFO" | jq -r '.title')"
        ARTIST_NAME="$(echo "$INFO" | jq -r '.artist')"
        PLAYER_STATE="paused"
        SPOTIFY_INFO="$TRACK_NAME|$ARTIST_NAME|$PLAYER_STATE"
    else
        SPOTIFY_INFO="not_running"
    fi
else
    # Fallback to AppleScript method
    SPOTIFY_INFO=$(get_spotify_info)
fi

if [ "$SPOTIFY_INFO" = "not_running" ] || [ "$SPOTIFY_INFO" = "error" ]; then
    # Read previous state to check if we need animation
    PREVIOUS_STATE=""
    if [ -f "$STATE_FILE" ]; then
        PREVIOUS_STATE=$(cat "$STATE_FILE")
    fi
    
    if [ "$PREVIOUS_STATE" != "not_running" ]; then
        # State changed to not running - animate out
        sketchybar --animate tanh 15 --set "$NAME" drawing=off
        echo "not_running" > "$STATE_FILE"
    else
        # Already not running - instant update
        sketchybar --animate linear 0 --set "$NAME" drawing=off
    fi
    exit 0
fi

# Parse the AppleScript output
TRACK_NAME=$(echo "$SPOTIFY_INFO" | cut -d'|' -f1)
ARTIST_NAME=$(echo "$SPOTIFY_INFO" | cut -d'|' -f2)
PLAYER_STATE=$(echo "$SPOTIFY_INFO" | cut -d'|' -f3)

# Current state string
CURRENT_STATE="$TRACK_NAME|$ARTIST_NAME|$PLAYER_STATE"

# Read previous state
PREVIOUS_STATE=""
if [ -f "$STATE_FILE" ]; then
    PREVIOUS_STATE=$(cat "$STATE_FILE")
fi

# Check if state changed (track, artist, or play state)
if [ "$CURRENT_STATE" != "$PREVIOUS_STATE" ]; then
    # State changed - use animation
    if [ "$PLAYER_STATE" = "playing" ]; then
        sketchybar --animate tanh 15 --set "$NAME" label="$TRACK_NAME - $ARTIST_NAME" drawing=on
    elif [ "$PLAYER_STATE" = "paused" ]; then
        sketchybar --animate tanh 15 --set "$NAME" label="⏸ $TRACK_NAME - $ARTIST_NAME" drawing=on
    else
        sketchybar --animate tanh 15 --set "$NAME" drawing=off
    fi
    
    # Save new state
    echo "$CURRENT_STATE" > "$STATE_FILE"
else
    # No change - update without animation (instant)
    if [ "$PLAYER_STATE" = "playing" ]; then
        sketchybar --animate linear 0 --set "$NAME" label="$TRACK_NAME - $ARTIST_NAME" drawing=on
    elif [ "$PLAYER_STATE" = "paused" ]; then
        sketchybar --animate linear 0 --set "$NAME" label="⏸ $TRACK_NAME - $ARTIST_NAME" drawing=on
    else
        sketchybar --animate linear 0 --set "$NAME" drawing=off
    fi
fi

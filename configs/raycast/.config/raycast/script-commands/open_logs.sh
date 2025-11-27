#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Open Datadog logs
# @raycast.mode silent

# Optional parameters:
# @raycast.icon ⇾

# Documentation:
# @raycast.description Prompts the user for a query and opens it in datadog
# @raycast.author Adam Higgins
# @raycast.authorURL https://github.com/adampeterhiggins
# @raycast.argument1 { "type": "text", "placeholder": "query", "optional": false}

QUERY="$1"

open -a Zen "https://app.datadoghq.eu/logs?query=$QUERY&agg_m=count&agg_m_source=base&agg_t=count&cols=host%2Cservice&fromUser=true&messageDisplay=inline&refresh_mode=sliding&storage=hot&stream_sort=desc&viz=stream&from_ts=1738151053031&to_ts=1738151953031&live=true"
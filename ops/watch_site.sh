#!/bin/bash
# H.I uptime watcher — checks every 2 minutes; repairs automatically on failure.
LOG="/Users/aegon/Desktop/Henderson Innovations/ops/uptime.log"
while true; do
  if "/Users/aegon/Desktop/Henderson Innovations/ops/check_site.sh" >> "$LOG" 2>&1; then
    :
  else
    echo "[$(date '+%m-%d %H:%M:%S')] OUTAGE DETECTED — auto-repair starting" >> "$LOG"
    "/Users/aegon/Desktop/Henderson Innovations/ops/repair_site.sh" >> "$LOG" 2>&1 || true
  fi
  sleep 120
done

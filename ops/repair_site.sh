#!/bin/bash
# H.I emergency repair — redeploys the frozen known-good build to Pages AND the
# hendersoninnovations.com edge proxy, then re-runs the check battery.
set -e
cd "/Users/aegon/Desktop/Henderson Innovations/ops/good-deploy"
echo "[$(date '+%m-%d %H:%M:%S')] redeploying pages from frozen good-deploy…"
npx --yes wrangler@latest pages deploy . --project-name henderson-innovations-site --branch main --commit-dirty=true >> /tmp/hi_repair.log 2>&1
cd /tmp/hi_edge 2>/dev/null || { mkdir -p /tmp/hi_edge && cp /Users/aegon/Desktop/Henderson\ Innovations/worker.js /tmp/hi_edge/worker.js && cd /tmp/hi_edge; }
echo "[$(date '+%m-%d %H:%M:%S')] redeploying edge proxy…"
npx --yes wrangler@latest deploy worker.js --name hendersoninnovations --compatibility-date 2026-01-15 >> /tmp/hi_repair.log 2>&1
sleep 5
if "/Users/aegon/Desktop/Henderson Innovations/ops/check_site.sh"; then
  echo "[$(date '+%m-%d %H:%M:%S')] REPAIR SUCCESS"
  exit 0
fi
echo "[$(date '+%m-%d %H:%M:%S')] repair ran but checks still failing — escalate"
exit 1

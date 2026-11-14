#!/bin/bash
# H.I deploy pipeline: build -> STAGE on preview URL -> verify -> promote to production.
# Usage: ./deploy_site.sh
set -e
REPO="/Users/aegon/Desktop/Henderson Innovations"
OPS="$REPO/ops"
PROJ="henderson-innovations-site"

rm -rf /tmp/pages_dist && mkdir -p /tmp/pages_dist
cd "$REPO"
rsync -a --exclude '.git' --exclude '.assetsignore' --exclude '.gitignore' --exclude 'ops' \
  --exclude 'scripts' --exclude 'store' --exclude 'node_modules' --exclude '.DS_Store' \
  --exclude 'wrangler.jsonc' --exclude 'wrangler.toml' --exclude 'worker.js' ./ /tmp/pages_dist/
cp worker.js /tmp/pages_dist/_worker.js
# served copies stay in lockstep with sources
cp index.html home; cp hind.html hind
cp client-preview/index.html client-preview/login
cp client-preview/viewer.html client-preview/view

cat > /tmp/pages_dist/wrangler.toml <<'TOML'
name = "henderson-innovations-site"
pages_build_output_dir = "."
compatibility_date = "2026-01-15"

[[kv_namespaces]]
binding = "HI_KV"
id = "d422c3da0eae42eab41ac3f8350fb06f"
TOML

cd /tmp/pages_dist
echo "[1/3] staging deploy (preview branch, production untouched)…"
npx --yes wrangler@latest pages deploy . --project-name $PROJ --branch preview --commit-dirty=true | tail -1
sleep 4
PREVIEW_URL="https://preview.$PROJ.pages.dev"
echo "[2/3] verifying preview…"
if ! "$OPS/check_site.sh" "$PREVIEW_URL"; then
  echo "PREVIEW CHECKS FAILED — production NOT touched. Aborting."
  exit 1
fi
echo "[3/3] promoting to production…"
npx --yes wrangler@latest pages deploy . --project-name $PROJ --branch main --commit-dirty=true | tail -1
sleep 4
"$OPS/check_site.sh" "https://hendersoninnovations.com"
echo "DEPLOY COMPLETE — production verified."

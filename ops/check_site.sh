#!/bin/bash
# H.I production check battery — exit 0 only when EVERYTHING works.
DOM="https://hendersoninnovations.com"
CRM="https://aegons-mac-mini-1.tail44007b.ts.net"
fail=0
c() { # url, expect
  local code; code=$(curl -s -o /dev/null -m 25 -w '%{http_code}' "$1")
  if [ "$code" != "$2" ]; then echo "FAIL $1 -> $code (want $2)"; fail=1; fi
}
c "$DOM/" 200
c "$DOM/index.html" 200
c "$DOM/hind.html" 200
c "$DOM/client-preview/" 200
curl -s -m 25 "$DOM/" | grep -qi "henderson innovations" || { echo "FAIL / content"; fail=1; }
curl -s -m 25 "$DOM/hind.html" | grep -q "clients on file" || { echo "FAIL hind content"; fail=1; }
rm -f /tmp/hi_check.jar
code=$(curl -s -c /tmp/hi_check.jar -m 25 -o /dev/null -w '%{http_code}' -X POST "$DOM/api/preview/login" -H 'Content-Type: application/json' -d '{"u":"santaprint","p":"SA6657"}')
[ "$code" = "200" ] || { echo "FAIL preview auth -> $code"; fail=1; }
code=$(curl -sL -b /tmp/hi_check.jar -m 25 -o /tmp/hi_check_site.html -w '%{http_code}' "$DOM/client-preview/sites/santa-s-print-shop/index.html")
[ "$code" = "200" ] || { echo "FAIL preview site -> $code"; fail=1; }
grep -q "Santa" /tmp/hi_check_site.html || { echo "FAIL preview site content"; fail=1; }
code=$(curl -s -m 25 -o /dev/null -w '%{http_code}' -X POST "$DOM/api/preview/login" -H 'Content-Type: application/json' -d '{"u":"santaprint","p":"nope"}')
[ "$code" = "401" ] || { echo "FAIL wrong-password guard -> $code"; fail=1; }
c "$CRM/login" 200
if [ "$fail" = "0" ]; then echo "ALL GREEN $(date '+%m-%d %H:%M:%S')"; fi
exit $fail

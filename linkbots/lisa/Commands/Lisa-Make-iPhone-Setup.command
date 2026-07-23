#!/bin/zsh
# Generate a fresh iPhone setup code, prepend it to Lisa-iPhone-Setup.txt
# in this Commands folder, and watch for pairing to auto-approve as "iPhone".
set -euo pipefail
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
OC=(node /Users/linktrend/Projects/openclaw_prime/openclaw.mjs --profile lisa)
COMMANDS_DIR="/Users/linktrend/Documents/LiNKwork/Openclaw Lisa Prime/Commands"
SETUP_TXT="${COMMANDS_DIR}/Lisa-iPhone-Setup.txt"
PUBLIC_URL="wss://linktrend-mini.tailf7e13a.ts.net:8443"
WATCH_MINUTES=15

echo "Generating fresh Lisa iPhone setup code…"
code="$("${OC[@]}" qr --public-url "$PUBLIC_URL" --setup-code-only 2>/dev/null | tr -d '\r\n' | tail -n 1)"
if [[ -z "$code" || "$code" != eyJ* ]]; then
  echo "ERROR: failed to generate setup code."
  echo "Raw output was: ${code:-<empty>}"
  read -k '?Press any key to close…'
  exit 1
fi

gen_at="$(date '+%Y-%m-%d %H:%M:%S %Z')"
exp_at="$(date -v+10M '+%Y-%m-%d %H:%M:%S %Z')"

tmp="$(mktemp)"
cat >"$tmp" <<EOF
Lisa iPhone — FRESH setup code (one-time re-pair only)
Generated: ${gen_at}
EXPIRES:   ${exp_at}  (≈10 minutes — do not reuse after expiry)

Paste this ENTIRE line in OpenClaw → Settings → Gateway, then Connect:

${code}

A watcher on this Mac Mini will auto-approve + label "iPhone" for the next
~${WATCH_MINUTES} minutes. You must Connect while the watcher is running.

After it connects once: delete macmini.local:18790 and any …ts.net :443
entry (Settings → Gateway → swipe → Forget). Keep only
linktrend-mini.tailf7e13a.ts.net:8443, and use Reconnect daily — no new code.

============================================================
DURABLE HOW-TO — daily reconnect does NOT need a new code
============================================================

EOF

if [[ -f "$SETUP_TXT" ]]; then
  # Keep the durable how-to body; drop any previous leading FRESH block.
  awk '
    /^Lisa iPhone — how to connect/ { keep=1 }
    keep { print }
  ' "$SETUP_TXT" >>"$tmp"
  if ! awk '/^Lisa iPhone — how to connect/{found=1} END{exit !found}' "$SETUP_TXT"; then
    cat "$SETUP_TXT" >>"$tmp"
  fi
fi

mv "$tmp" "$SETUP_TXT"
chmod 600 "$SETUP_TXT"
echo
echo "Wrote fresh code to: $SETUP_TXT"
echo "$code"
echo
echo "Watching for iPhone pairing for ~${WATCH_MINUTES} minutes…"
echo "On iPhone: Tailscale ON → OpenClaw → Settings → Gateway → paste code → Connect."
echo

deadline=$(( $(date +%s) + WATCH_MINUTES * 60 ))
while (( $(date +%s) < deadline )); do
  out="$(/Users/linktrend/.openclaw-lisa/bin/approve-latest-device "iPhone" 2>&1 || true)"
  print -r -- "$out"
  if print -r -- "$out" | rg -q 'Approving request'; then
    echo
    echo "SUCCESS — approved latest request as iPhone."
    break
  fi
  sleep 5
done

echo
"${OC[@]}" devices list
echo
read -k '?Press any key to close…'

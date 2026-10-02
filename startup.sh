#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if ! curl -sf -o /dev/null --max-time 2 http://127.0.0.1:43119/health; then
  mkdir -p .bunny-a
  nohup npm run host >>.bunny-a/host.log 2>&1 </dev/null &
fi
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
nohup npm run dev >>.grok/dev.log 2>&1 </dev/null &

#!/bin/sh
set -eu

cd /app

LOCK_DIR="/app/.docker-npm-install.lock"

while ! mkdir "$LOCK_DIR" 2>/dev/null; do
  sleep 1
done

cleanup() {
  rm -rf "$LOCK_DIR"
}
trap cleanup EXIT INT TERM

needs_install=0

if [ ! -d node_modules ]; then
  needs_install=1
fi

if [ "$needs_install" -eq 0 ]; then
  for required_file in \
    node_modules/@nestjs/core/helpers/execution-context-host.js \
    node_modules/@nestjs/core/helpers/get-class-scope.js \
    node_modules/@nestjs/cli/bin/nest.js \
    node_modules/@langchain/langgraph/package.json \
    node_modules/mammoth/package.json \
    node_modules/pdf-parse/package.json \
    node_modules/xlsx/package.json \
    node_modules/vite/bin/vite.js \
    node_modules/vue-tsc/bin/vue-tsc.js
  do
    if [ ! -f "$required_file" ]; then
      needs_install=1
      break
    fi
  done
fi

if [ "$needs_install" -eq 0 ]; then
  if [ ! -L node_modules/llm-gather ] || [ ! -L node_modules/llm-gather-frontend ]; then
    needs_install=1
  fi
fi

if [ "$needs_install" -eq 1 ]; then
  mkdir -p node_modules
  rm -rf node_modules/* node_modules/.[!.]* node_modules/..?* 2>/dev/null || true
  npm ci --include=dev
fi

cleanup
trap - EXIT INT TERM

exec "$@"

#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  printf 'Run this command from inside the chemistry app repository.\n' >&2
  exit 1
}
cd "$repo_root"

web_port="${WEB_PORT:-3001}"
api_port="${API_PORT:-8001}"
lan_ip="${LAN_IP:-$(python3 -c 'import socket; s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(("192.0.2.1", 80)); print(s.getsockname()[0]); s.close()')}"
web_origin="http://${lan_ip}:${web_port}"

fail() {
  printf 'local:lan: %s\n' "$1" >&2
  exit 1
}

for port in "$web_port" "$api_port"; do
  if fuser -n tcp "$port" >/dev/null 2>&1; then
    fail "port $port is already in use; stop its owner or set WEB_PORT/API_PORT."
  fi
done

MAILPIT_UI_BIND_IP="$lan_ip" docker compose up -d --wait database mailpit
uv --directory apps/api run alembic upgrade head
API_PROXY_TARGET="http://127.0.0.1:${api_port}" \
  NEXT_PUBLIC_CSRF_COOKIE_NAME=inorganic_csrf \
  NEXT_PUBLIC_SESSION_COOKIE_NAME=inorganic_session pnpm build

api_pid=''
web_pid=''
mail_pid=''
stop_group() {
  local pid="$1"
  local pgid=''
  [[ -z "$pid" ]] || pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')"
  [[ -z "$pgid" ]] || kill -TERM -- "-${pgid}" 2>/dev/null || true
  if [[ -n "$pid" ]]; then
    for _ in {1..20}; do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.25
    done
    kill -KILL -- "-${pgid}" 2>/dev/null || true
  fi
  [[ -z "$pid" ]] || wait "$pid" 2>/dev/null || true
}
cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  stop_group "$web_pid"
  stop_group "$api_pid"
  stop_group "$mail_pid"
  exit "$exit_code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

setsid env \
  APP_ENV=development \
  PUBLIC_ORIGIN="$web_origin" \
  WEB_ORIGINS="[\"${web_origin}\"]" \
  SESSION_COOKIE_NAME=inorganic_session \
  CSRF_COOKIE_NAME=inorganic_csrf \
  SESSION_COOKIE_SECURE=false \
  SMTP_HOST=127.0.0.1 \
  SMTP_PORT=1025 \
  SMTP_FROM=noreply@example.invalid \
  SMTP_STARTTLS=false \
  uv --directory apps/api run uvicorn inorganic_api.main:app --host 127.0.0.1 --port "$api_port" &
api_pid=$!
setsid env \
  APP_ENV=development \
  PUBLIC_ORIGIN="$web_origin" \
  WEB_ORIGINS="[\"${web_origin}\"]" \
  SESSION_COOKIE_NAME=inorganic_session \
  CSRF_COOKIE_NAME=inorganic_csrf \
  SESSION_COOKIE_SECURE=false \
  SMTP_HOST=127.0.0.1 \
  SMTP_PORT=1025 \
  SMTP_FROM=noreply@example.invalid \
  SMTP_STARTTLS=false \
  uv --directory apps/api run python -m inorganic_api.mail_worker &
mail_pid=$!
setsid env HOSTNAME=0.0.0.0 PORT="$web_port" \
  node apps/web/.next/standalone/apps/web/server.js &
web_pid=$!

wait_for_http() {
  local url="$1"
  local pid="$2"
  local description="$3"
  for _ in {1..40}; do
    if curl --silent --show-error --fail --output /dev/null "$url" 2>/dev/null; then
      printf 'Ready: %s\n' "$url"
      return
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      fail "$description exited before becoming ready."
    fi
    sleep 1
  done
  fail "$description did not become ready at $url."
}

wait_for_http "http://127.0.0.1:${api_port}/api/v1/health/ready" "$api_pid" 'API'
wait_for_http "http://127.0.0.1:${web_port}/login" "$web_pid" 'Frontend'
wait_for_http "${web_origin}/register" "$web_pid" 'Registration page'

printf '\nLAN app: %s\n' "$web_origin"
printf 'API health: http://127.0.0.1:%s/api/v1/health/ready\n' "$api_port"
printf 'Mailpit inbox: http://%s:8025\n' "$lan_ip"
printf 'This HTTP setup is for a trusted local network; do not expose it to the Internet.\n'
printf 'Press Ctrl+C to stop the frontend, API and mail worker. PostgreSQL and Mailpit stay running.\n'

while true; do
  if ! kill -0 "$api_pid" 2>/dev/null; then
    wait "$api_pid" || fail 'API stopped unexpectedly.'
    fail 'API stopped unexpectedly.'
  fi
  if ! kill -0 "$web_pid" 2>/dev/null; then
    wait "$web_pid" || fail 'Frontend stopped unexpectedly.'
    fail 'Frontend stopped unexpectedly.'
  fi
  if ! kill -0 "$mail_pid" 2>/dev/null; then
    wait "$mail_pid" || fail 'Mail worker stopped unexpectedly.'
    fail 'Mail worker stopped unexpectedly.'
  fi
  sleep 1
done

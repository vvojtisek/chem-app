#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  printf 'Run this command from inside the chemistry app repository.\n' >&2
  exit 1
}
cd "$repo_root"

fail() {
  printf 'local:update: %s\n' "$1" >&2
  exit 1
}

branch="$(git branch --show-current)"
[[ -n "$branch" ]] || fail 'detached HEAD; switch to main or a named test branch first.'

dirty=0
if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
  dirty=1
fi

printf 'Checking the current branch: %s\n' "$branch"
git fetch --prune

upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
if [[ -z "$upstream" ]]; then
  upstream="origin/$branch"
fi
git show-ref --verify --quiet "refs/remotes/$upstream" || \
  fail "no remote tracking branch found for '$branch' (expected '$upstream')."

read -r behind ahead < <(git rev-list --left-right --count "$upstream...HEAD")
if (( behind > 0 && dirty > 0 )); then
  fail "'$branch' has $behind incoming commit(s) and local changes. Commit or stash them, then run local:update again; nothing was overwritten."
fi

if (( behind > 0 )); then
  printf 'Fast-forwarding %s from %s.\n' "$branch" "$upstream"
  git merge --ff-only "$upstream"
elif (( ahead > 0 )); then
  printf 'Remote is current; keeping %s local commit(s) on %s.\n' "$ahead" "$branch"
else
  printf 'Already up to date with %s.\n' "$upstream"
fi

if (( dirty > 0 )); then
  printf 'Keeping local uncommitted changes; no incoming commits need merging.\n'
fi

pnpm install --frozen-lockfile
uv --directory apps/api sync --frozen --extra test
docker compose up -d database

printf 'Building the current checkout.\n'
pnpm build

stop_existing_listener() {
  local port="$1"
  local service="$2"
  local expected_directory="$3"
  local pids pid process_directory command_line matches

  pids="$(fuser -n tcp "$port" 2>/dev/null || true)"
  for pid in $pids; do
    process_directory="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
    command_line="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
    matches=0
    case "$service" in
      web)
        if [[ "$command_line" == *next* ]] && \
          { [[ "$command_line" == *dev* ]] || [[ "$command_line" == *start* ]] || [[ "$command_line" == *next-server* ]]; }; then
          matches=1
        fi
        ;;
      api)
        if [[ "$command_line" == *uvicorn*inorganic_api.main:app* ]]; then
          matches=1
        fi
        ;;
    esac
    if [[ "$process_directory" != "$expected_directory" || "$matches" != 1 ]]; then
      fail "port $port is occupied by another process (PID $pid); it was left running."
    fi

    printf 'Stopping the old local %s server (PID %s).\n' "$service" "$pid"
    kill -TERM "$pid"
    for _ in {1..20}; do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.25
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL "$pid"
    fi
  done
}

stop_process_group() {
  local pid="$1"
  if kill -0 "$pid" 2>/dev/null; then
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    for _ in {1..20}; do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.25
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
    fi
  fi
  wait "$pid" 2>/dev/null || true
}

api_pid=''
web_pid=''
cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  [[ -z "$web_pid" ]] || stop_process_group "$web_pid"
  [[ -z "$api_pid" ]] || stop_process_group "$api_pid"
  exit "$exit_code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

stop_existing_listener 3000 web "$repo_root/apps/web"
stop_existing_listener 8000 api "$repo_root/apps/api"

printf 'Starting API and frontend from %s (%s).\n' "$(git rev-parse --short HEAD)" "$branch"
setsid env WEB_ORIGINS='["http://localhost:3000","http://127.0.0.1:3000"]' \
  uv --directory apps/api run uvicorn inorganic_api.main:app --host 127.0.0.1 --port 8000 &
api_pid=$!
setsid pnpm --filter @inorganic/web start --hostname 127.0.0.1 &
web_pid=$!

wait_for_http() {
  local url="$1"
  local process_pid="$2"
  local description="$3"
  for _ in {1..40}; do
    if curl --silent --show-error --fail --output /dev/null "$url" 2>/dev/null; then
      printf 'Ready: %s\n' "$url"
      return
    fi
    if ! kill -0 "$process_pid" 2>/dev/null; then
      fail "$description exited before becoming ready."
    fi
    sleep 1
  done
  fail "$description did not become ready at $url."
}

wait_for_http 'http://127.0.0.1:8000/api/v1/health' "$api_pid" 'API'
wait_for_http 'http://127.0.0.1:3000/' "$web_pid" 'Frontend'
wait_for_http 'http://127.0.0.1:3000/procvicovani/periodicka-tabulka/nazvy' "$web_pid" 'Named periodic-table practice'
wait_for_http 'http://127.0.0.1:3000/procvicovani/nazvoslovi' "$web_pid" 'Nomenclature practice'

printf '\nLocal app is ready at http://127.0.0.1:3000\n'
printf 'API health: http://127.0.0.1:8000/api/v1/health\n'
printf 'Press Ctrl+C to stop the frontend and API. The local database stays running.\n'

while true; do
  if ! kill -0 "$api_pid" 2>/dev/null; then
    wait "$api_pid" || fail 'API stopped unexpectedly.'
    fail 'API stopped unexpectedly.'
  fi
  if ! kill -0 "$web_pid" 2>/dev/null; then
    wait "$web_pid" || fail 'Frontend stopped unexpectedly.'
    fail 'Frontend stopped unexpectedly.'
  fi
  sleep 1
done

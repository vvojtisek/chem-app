# ADR 0012: Update production from published images with Watchtower

- Status: Proposed
- Date: 2026-10-09
- Decision owners: Product owner and engineering
- Amends: the build-on-host update procedure in `deploy/aws/README.md`

## Context

Releases are cut by release-please (ADR 0011). Production builds every image
on the EC2 host from a Git checkout (`build:` in `docker-compose.prod.yml`) and
an operator runs the update over SSM: `git pull`, `build`, `run --rm migrate`,
`up -d`. Administrators can already see that a newer release exists (#63).

The product owner wants administrators to apply a release from the app with an
"Update now" button, using Watchtower. The option was chosen with these costs
stated: it needs a registry, it must handle migrations, and it gives a
container the Docker socket.

Watchtower can only update containers whose image tag can be pulled again from
a registry. The original `containrrr/watchtower` was archived on 2025-12-17;
its last release, v1.7.1, is from November 2023. The maintained fork
`nicholas-fedor/watchtower` (v1.23.0 on 2026-10-09) adds an HTTP API with
token authentication, an `update` endpoint, health-check waiting between
containers and dependency-ordered restarts.

## Decision

1. **Published images.** When release-please publishes `vX.Y.Z`, the Release
   workflow builds the `api` and `web` images from that tag and pushes them to
   GHCR as `ghcr.io/vvojtisek/chem-app-api` and `-web`, tagged `X.Y.Z` and
   `stable`. Images are public; they contain no configuration or secrets
   (only `API_PROXY_TARGET=http://api:8000`). Production runs `:stable`.
2. **Watchtower fork, pinned by digest.** Production adds
   `nickfedor/watchtower` pinned to a digest. It runs with label-only
   selection, so it updates only `api`, `worker`, `web` and `migrate`. It never
   touches `caddy` or `db`. Periodic polling is off; it updates only when the
   HTTP API asks it to.
3. **Migrations before the new API.** `migrate` becomes a long-running service:
   it runs `alembic upgrade head` and becomes healthy only after that
   succeeds. `api` and `worker` depend on it being healthy. Watchtower updates
   in dependency order and waits for each container's health check, so the new
   schema is in place before the new API starts.
4. **Isolated update channel.** Watchtower's HTTP API listens only on a
   dedicated Docker network shared with `api`. It is never published on a host
   port or through Caddy, it requires a bearer token
   (`WATCHTOWER_HTTP_API_TOKEN`, a new secret in `.env.production`), and only
   the `update` endpoint is enabled.
5. **Admin button.** `POST /api/v1/admin/releases/update` requires the admin
   role, the CSRF token and an allowed Origin. It is rate limited, writes an
   audit log entry, and asks Watchtower to update asynchronously. The web
   header shows "Aktualizovat na vX.Y.Z" only to admins, only when a newer
   release exists, and asks for confirmation.
6. **Manual path stays.** The SSM procedure remains the fallback and the only
   path for changes to Caddy, the database, Compose files or `.env.production`,
   none of which Watchtower can apply.

## Consequences

Security properties that change (flagged per project policy):

- **Docker socket.** Watchtower mounts `/var/run/docker.sock`, which is
  root-equivalent on the host. A socket proxy was considered and not adopted:
  Watchtower needs container create, start, stop and remove plus image pull,
  and container create alone allows a host takeover, so a proxy would add a
  third-party component without removing that capability.
- **Admin session reaches the host.** Anyone who controls an admin session can
  trigger a deployment of the current `stable` image. They cannot choose
  which image runs. That is decided by what CI pushed to `stable`, which
  requires write access to the GitHub repository.
- **Owner DB credentials stay resident.** `MIGRATION_DATABASE_URL` (the owner
  role) now lives in a long-running `migrate` container instead of a one-shot
  run. The container stays on `internal-net` only, read-only, with all
  capabilities dropped.
- **Supply chain.** Production pulls from GHCR. Compromise of the repository,
  its Actions or the GHCR package now reaches production without an operator
  running `git pull`.

Operational:

- Migrations must stay backward compatible with the previous release (expand,
  then contract), because old `web` keeps serving until it is replaced and a
  failed update can leave old and new containers side by side.
- If `migrate` does not become healthy within Watchtower's 5-minute wait,
  Watchtower logs a warning and continues. The API readiness check must then
  report the schema mismatch. Rollback means re-tagging `stable` to the
  previous version and updating again.
- There is no automatic database backup before an update. The EBS snapshot
  policy and the `pg_dump` procedure in `docs/deployment.md` remain the
  recovery path, and neither is verified on the host.
- None of this can be tested without a Docker daemon. Each phase needs a
  staged run on a non-production host before it reaches production.

## Rollout

1. ADR (this document).
2. Release workflow publishes images to GHCR.
3. Compose: `image:` for `api`, `worker`, `web` and `migrate`; long-running
   `migrate` with a health check; Watchtower service and update network.
   Runbook update.
4. API endpoint and admin button.

Each phase is a separate pull request. Production changes only when an
operator applies a merged phase on the host.

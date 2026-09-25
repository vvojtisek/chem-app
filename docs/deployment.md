# Production deployment

The production Compose stack serves the web app and API on one HTTPS origin.
Caddy terminates TLS and routes `/api/*` to FastAPI; all other requests go to
Next.js. PostgreSQL has no published host port and is reachable only over the
internal Docker network. Use a dedicated Linux server with Docker Engine and
the Docker Compose plugin.

## Before deployment

1. Choose the public hostname. `chemie.vvojtisek.eu` is the example in this
   repository; replace it if another subdomain is preferred.
2. Create an `A` DNS record for that name pointing at the server's public IPv4
   address. Add an `AAAA` record only if the host and firewall support public
   IPv6. Allow inbound TCP ports 80 and 443 and UDP 443; keep SSH restricted
   to the operator's management addresses. Caddy obtains and renews TLS
   certificates automatically.
3. Clone the repository on the server and create a private environment file:

   ```sh
   cp .env.production.example .env.production
   chmod 600 .env.production
   ```

4. Edit `.env.production`. Set `DOMAIN`, `ACME_EMAIL`, and fresh, unique
   secrets. Generate URL-safe database passwords and a random session/throttle
   secret, for example with `openssl rand -hex 32`. Set unique passwords of
   at least 12 characters for all three initial accounts. Configure `SMTP_HOST`,
   `SMTP_FROM`, and credentials for a relay that supports STARTTLS. Do not reuse
   the example values. The example hostname is `chemie.vvojtisek.eu`.
5. Keep this file out of Git and backups accessible to other users. The
   committed `.env.production.example` is only a placeholder template.
6. Before opening public registration, complete the [privacy notice release
   checklist](privacy-notice-release-checklist.md), publish the operator's
   identity and contact on `/soukromi`, and review the
   [known limitations](known-limitations.md). The in-app notice is explicitly
   incomplete until then.
7. Confirm that `pnpm content:release-check` passes before publishing the
   curriculum. Automated balance and parser checks are not a substitute for
   the required chemistry-SME review.

The example uses separate PostgreSQL owner and runtime roles. The database
initialization script creates the runtime role with application DML rights;
Alembic runs as the owner. The initialization script runs only when the
PostgreSQL data volume is first created. If initialization fails on a new
installation, inspect logs before retrying. Do not delete a data volume to
repair an existing installation.

## First start

Run commands from the repository root on the server:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d db
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm migrate
docker compose --env-file .env.production -f docker-compose.prod.yml --profile setup run --rm seed
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

The migration task must complete before the API starts accepting traffic. The
seed command is idempotent and does not change an existing account. After it
succeeds, remove all `SEED_*` entries from `.env.production` and keep the
initial passwords in the operator's password manager. Public registration and
self-service password recovery are enabled; new accounts set their password
after following an email verification link. Confirm that Caddy, API, mail
worker, web, and DB containers are running,
then open `https://<DOMAIN>` and verify login with the three provisioned roles.
Check that non-admin accounts receive `403` from admin-only APIs and that no
database port is published:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 caddy api mail-worker web db
```

## Updating the application

Before each update, create and verify an encrypted PostgreSQL backup. Then
fetch the approved revision, rebuild the images, and start the stack. Compose
runs the migration task before starting a new API container:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Review release notes for migration recovery instructions. Prefer forward fixes
for applied migrations. Do not downgrade a database unless the migration
explicitly supports it and a tested backup is available.
Migration `0005_progress_generation` establishes the progress-reset boundary.
Do not downgrade past it after any account has reset progress: old immutable
events remain archived and the downgrade would remove the generation barrier.

## Backups and recovery

Create an encrypted custom-format dump and copy it to storage outside the
server. Restrict access to the backup and test restoration to a separate,
isolated PostgreSQL instance before relying on it:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > inorganic-chemistry.dump
```

Restore only into a stopped or isolated target database, never over the live
instance without a reviewed recovery plan. Preserve Caddy's `/data` volume so
renewed certificates and account state are retained. PostgreSQL's named volume
is the authoritative account and synchronized-attempt store.

## Account and secret operations

- Public registration and password recovery use the configured SMTP relay.
  Keep its credentials in `.env.production` with owner-only permissions or
  inject them through the host's secret manager.
- Registration and recovery requests queue messages in PostgreSQL and return
  immediately. The `mail-worker` service reaches the external SMTP relay through
  `public-net` and PostgreSQL through `internal-net`; confirm relay connectivity
  when deploying. It retries SMTP failures. Watch its logs
  and the age of pending `mail_outbox` rows; an accepted `202` response confirms
  queueing rather than delivery. Missing SMTP configuration returns `503` for
  every address. Keep `SECRET_KEY` stable while mail is pending: rotating it
  makes existing queued links unreadable and users must request new links.
- Unverified accounts expire after seven days. Verification rejects old
  accounts even before the scheduled purge removes their rows.
- Password changes revoke that account's sessions. Admins can manage profile
  details and set new passwords from `/admin`.
- Schedule the combined expired-state purge daily from the host (for example,
  at 03:17) with this cron command:
  `17 3 * * * cd /srv/chem-app && docker compose --env-file .env.production -f docker-compose.prod.yml exec -T api python -m inorganic_api.cli purge-expired >> /var/log/chem-app-purge.log 2>&1`.
  It removes expired sessions and mail tokens, old throttle rows, pending
  email-verification accounts older than seven days, and stale guest
  accounts/outbox rows.
- If `SECRET_KEY` is exposed, replace it and revoke all active sessions with
  `docker compose --env-file .env.production -f docker-compose.prod.yml exec api python -m inorganic_api.cli purge-sessions --all`; rotate account passwords as needed. Session records are server-side; changing this key alone is not a substitute for session revocation.
- Remove seed passwords from the environment file after initial setup. Keep
  runtime and owner database credentials separate.
- The offline browser marker is a convenience gate only. Local learning data
  remains readable to someone with access to the browser profile or device.

## Operational limits

The deployment uses a fixed private Docker subnet `172.30.0.0/24`; check for
conflicts with existing host networks before starting the stack. The API trusts
forwarded headers only from the Caddy container address on that network.

This repository prepares the application and runbook but does not create DNS
records, configure the server firewall, provision the host, or deploy the
stack. Those steps require the selected hostname and server access.

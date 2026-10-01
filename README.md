# Inorganic chemistry learning application

Offline-capable Czech learning application for periodic-table practice, chemical equations, inorganic nomenclature, and preparation/production review.

## Repository

- `apps/web` — Next.js App Router PWA
- `apps/api` — FastAPI service and PostgreSQL persistence boundary
- `packages/chemistry` — pure deterministic chemistry logic
- `packages/contracts` — generated OpenAPI TypeScript types
- `packages/ui` — accessible React primitives
- `content` — reviewed curriculum authoring data and validators
- `docs` — product, architecture, contracts, security, testing, deployment, and ADRs

Read `AGENTS.md` and the nested instruction file for the area being changed before editing.

## Prerequisites

- Node.js 24
- pnpm 11.7.0
- Python 3.12 or newer
- `uv` 0.12 or newer
- Docker with Compose for local PostgreSQL and Mailpit

## Install

```bash
pnpm install --frozen-lockfile
uv --directory apps/api sync --frozen --extra test
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

The copied `.env` is local-only and must not be committed.

## Local development

Start PostgreSQL and the local email catcher:

```bash
pnpm db:up
```

Run the API in one terminal:

```bash
pnpm dev:api
```

Run the web application in another:

```bash
pnpm dev:web
```

The web application is served at `http://localhost:3000`; API documentation is available at `http://localhost:8000/docs` during local development. Registration and password recovery emails are captured by Mailpit at `http://localhost:8025`.

To refresh and restart the local stack in one command, run `pnpm local:update` from the repository. It updates the currently checked-out branch from its tracking branch using fast-forward only, syncs locked dependencies, starts PostgreSQL and Mailpit, builds the current checkout, and runs the API and frontend on ports 8000 and 3000. Mailpit's SMTP listener is on port 1025 and its inbox is at `http://localhost:8025`. Press Ctrl+C to stop the API and frontend; the database and Mailpit keep running. It refuses to merge incoming commits over uncommitted changes and never switches branches. In Codex, select **Update local app** from the `/` menu or invoke `$update`; this workflow is only installed in this repository.

To test on another device on the same trusted Wi-Fi/LAN, run `pnpm local:lan`. It applies database migrations, builds the local HTTP cookie configuration, starts the API on loopback and the frontend on port 3001 on the LAN interface, and shows the address to open on the iPad. Mailpit's inbox is also exposed on the current LAN IP at port 8025 so you can open registration and recovery links there. If the OS firewall blocks access, allow TCP 3001 and 8025 only from your private network. This development mode uses HTTP and non-secure cookies; do not expose it to the public Internet. Press Ctrl+C to stop the app servers.

## Generated API contracts

FastAPI OpenAPI is canonical. After an API schema change, regenerate and verify the committed artifacts:

```bash
pnpm contracts:generate
pnpm contracts:check
```

Do not edit `packages/contracts/openapi.json` or `packages/contracts/src/schema.d.ts` manually.

## Quality gate

Run the full gate documented in `docs/testing.md` before declaring a change complete:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm content:validate
pnpm contracts:check
uv --directory apps/api run ruff format --check .
uv --directory apps/api run ruff check .
uv --directory apps/api run pytest -q
pnpm build
pnpm test:e2e
```

Chemistry-content changes additionally require SME review; passing validation alone is not approval.

## Production deployment

Production runs as one Docker Compose stack defined in `docker-compose.prod.yml`
(`compose.yaml` is only the local development database and Mailpit). Caddy
terminates HTTPS on port 443, sends `/api/*` to FastAPI and everything else to
Next.js. PostgreSQL has no published port. The steps below target a single AWS
EC2 instance whose security group allows only inbound TCP 443. Background on
upgrades, backups, and secret rotation is in
[`docs/deployment.md`](docs/deployment.md).

| Service       | Role                                  | Healthcheck                                    | Restart          |
| ------------- | ------------------------------------- | ---------------------------------------------- | ---------------- |
| `caddy`       | TLS termination, reverse proxy        | Caddy admin API on `127.0.0.1:2019`            | `unless-stopped` |
| `web`         | Next.js server                        | `GET http://127.0.0.1:3000`                    | `unless-stopped` |
| `api`         | FastAPI                               | `GET /api/v1/health/ready` (includes DB query) | `unless-stopped` |
| `mail-worker` | Delivers queued verification/reset mail | Heartbeat file touched after each poll (max age 120 s) | `unless-stopped` |
| `db`          | PostgreSQL 17                         | `pg_isready` over TCP                          | `unless-stopped` |
| `migrate`     | One-shot `alembic upgrade head`       | none (must exit 0 before `api` starts)         | `no`             |
| `seed`        | One-shot initial accounts (`setup` profile) | none                                     | `no`             |

A container that exits or crashes is restarted automatically, including after
a host reboot. Docker Compose does **not** restart a container that is running
but reports `unhealthy`; the status is for startup ordering (`depends_on`) and
monitoring. The API and mail worker leave that state by themselves once the
database is reachable again.

### 1. Create the EC2 infrastructure from AWS CloudShell

The CloudFormation template creates the EC2 host, installs Docker and the
Compose plugin, configures SSM and the Czech IPv4 firewall, creates an Elastic
IP and DNS record, and builds Caddy with Route 53 DNS-01 support. Choose one of
the two network options below. Do not run both for the same hostname.

1. In the AWS console, select **Europe (Frankfurt) `eu-central-1`** and open
   CloudShell.
2. On your computer, locate `deploy/aws/stack.yaml`. In CloudShell choose
   **Actions → Upload file**, select that template, and upload it to the
   CloudShell home directory ([AWS upload guide](https://docs.aws.amazon.com/cloudshell/latest/userguide/getting-started.html)).
   Confirm it is present:

   ```bash
   ls -l ~/stack.yaml
   ```

   The template fetches the bootstrap scripts from the public GitHub
   repository. After this change merges, use `main`. While the PR is still
   open, set `BOOTSTRAP_REF=feat/deploy-aws-vscht-frankfurt` below.
3. Set the stack name and bootstrap revision, then validate the uploaded file:

   ```bash
   export AWS_REGION=eu-central-1
   export STACK_NAME=chem-app-vscht
   export BOOTSTRAP_REF=main
   aws cloudformation validate-template \
     --region "$AWS_REGION" \
     --template-body file://$HOME/stack.yaml
   ```

   The CloudShell identity needs permission to create CloudFormation, EC2/VPC,
   IAM roles, Elastic IPs, and the Route 53 record. CloudFormation requires
   `CAPABILITY_IAM` because the template creates an instance role.

These commands create a new stack named `chem-app-vscht` and write the
`vscht.vvojtisek.eu` DNS record. Do not run them again if that stack already
exists; use a reviewed CloudFormation update for an existing deployment.

#### Option A: create a dedicated VPC and the EC2 host

This option creates a VPC, public subnet, internet gateway and route, along
with the EC2 instance and its supporting resources:

```bash
aws cloudformation create-stack \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --template-body "file://$HOME/stack.yaml" \
  --capabilities CAPABILITY_IAM \
  --parameters \
    ParameterKey=NetworkMode,ParameterValue=CreateVpc \
    ParameterKey=BootstrapRef,ParameterValue="$BOOTSTRAP_REF"

aws cloudformation wait stack-create-complete \
  --region "$AWS_REGION" --stack-name "$STACK_NAME"
aws cloudformation describe-stacks \
  --region "$AWS_REGION" --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs' --output table
```

#### Option B: use an existing VPC and public subnet

Use a subnet with a route to an internet gateway, DNS enabled for its VPC, and
outbound HTTPS. The stack adds its own security group and instance without
changing the VPC or subnet. Enter the IDs when prompted; the commands are
otherwise ready to paste:

```bash
read -r -p 'Existing VPC ID (vpc-...): ' EXISTING_VPC_ID
read -r -p 'Public subnet ID (subnet-...): ' EXISTING_PUBLIC_SUBNET_ID

aws cloudformation create-stack \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --template-body "file://$HOME/stack.yaml" \
  --capabilities CAPABILITY_IAM \
  --parameters \
    ParameterKey=NetworkMode,ParameterValue=ExistingVpc \
    ParameterKey=ExistingVpcId,ParameterValue="$EXISTING_VPC_ID" \
    ParameterKey=ExistingPublicSubnetId,ParameterValue="$EXISTING_PUBLIC_SUBNET_ID" \
    ParameterKey=BootstrapRef,ParameterValue="$BOOTSTRAP_REF"

aws cloudformation wait stack-create-complete \
  --region "$AWS_REGION" --stack-name "$STACK_NAME"
aws cloudformation describe-stacks \
  --region "$AWS_REGION" --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs' --output table
```

Both options use an Amazon Linux 2023 ARM64 `t4g.small`, allow only HTTPS
ingress, and do not open SSH. Once the stack completes, connect through SSM
using the `InstanceId` output:

```bash
INSTANCE_ID=$(aws cloudformation describe-stacks \
  --region "$AWS_REGION" --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`InstanceId`].OutputValue' \
  --output text)
aws ssm start-session --region "$AWS_REGION" --target "$INSTANCE_ID"
```

Run this command from CloudShell or another terminal using AWS credentials
that can start a session. The instance role also allows a process using its
credentials (such as the VS Code terminal on the instance) to start a shell
session to an EC2 instance tagged for this CloudFormation stack. For an
existing stack, upload the updated `deploy/aws/stack.yaml` and update the stack
with `CAPABILITY_IAM` before retrying; this adds the scoped session permission
to the instance role.

The host already contains `/srv/chem-app` at the selected `BOOTSTRAP_REF`,
Docker, Compose, swap, and the nftables filter. Do not install Docker or create
another DNS record manually. Plain HTTP on port 80 is not exposed; use HTTPS.

To update an existing stack with the session-role fix, upload the new
`deploy/aws/stack.yaml` to CloudShell as `stack.yaml`, then run this with an
AWS identity that can update the stack and its IAM role:

```bash
aws cloudformation update-stack \
  --region eu-central-1 \
  --stack-name chem-app-vscht \
  --template-body "file://$HOME/stack.yaml" \
  --capabilities CAPABILITY_IAM \
  --parameters \
    ParameterKey=NetworkMode,UsePreviousValue=true \
    ParameterKey=ExistingVpcId,UsePreviousValue=true \
    ParameterKey=ExistingPublicSubnetId,UsePreviousValue=true \
    ParameterKey=HostedZoneId,UsePreviousValue=true \
    ParameterKey=BootstrapRef,UsePreviousValue=true

aws cloudformation wait stack-update-complete \
  --region eu-central-1 --stack-name chem-app-vscht
```

The update preserves the stack's current network and bootstrap parameters. It
does not rebuild or restart the application.

### 2. Configure the deployment

In the SSM session, become root and create the private production file in the
existing checkout:

```bash
sudo -i
cd /srv/chem-app
cp .env.production.example .env.production
chmod 600 .env.production
```

Edit `.env.production`:

- `DOMAIN`: the hostname from the DNS record; `ACME_EMAIL`: your address for
  Let's Encrypt notices.
- `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, `SECRET_KEY`: separate fresh values
  from `openssl rand -hex 32`. Put the same two database passwords into
  `MIGRATION_DATABASE_URL` (owner) and `DATABASE_URL` (runtime).
- `PUBLIC_ORIGIN` and `CORS_ORIGINS` are derived from `DOMAIN` by Compose; you
  can leave the example lines untouched.
- `SMTP_*`: a relay that supports STARTTLS, for example Amazon SES SMTP
  credentials, with a verified `SMTP_FROM` sender. The API refuses to start in
  production without SMTP settings.
- `SEED_*`: usernames and unique passwords of at least 12 characters for the
  initial admin, user, and tester accounts.

The API validates this configuration at startup and exits with an explanatory
error if a secret is missing, a placeholder, or too short.

Public registration is open but limited to one request per client IP per hour
(`REGISTER_IP_LIMIT` in `apps/api/src/inorganic_api/services/accounts.py`).
Guest login is disabled: `POST /api/v1/auth/guest` returns `404` unless the API
runs with `GUEST_LOGIN_ENABLED=true`, and the login page has no guest button.

To keep commands short, define an alias for the rest of the session:

```bash
alias dc='docker compose --env-file .env.production -f docker-compose.prod.yml'
```

### 3. Build and start

```bash
dc build                          # several minutes on first run
dc up -d db                       # first start initialises the database roles
dc run --rm migrate               # applies migrations as the owner role
dc --profile setup run --rm seed  # creates the three initial accounts once
dc up -d --wait                   # starts everything; returns when all are healthy
```

`--wait` exits non-zero if any service fails to become healthy within its
start period; inspect the logs as shown below. After the seed succeeds, delete
all `SEED_*` lines from `.env.production` and keep the passwords in a password
manager.

### 4. Verify container health

```bash
dc ps
```

Every long-running service must show `Up … (healthy)`; `migrate` shows
`Exited (0)`. For details on one container, including the output of recent
health probes:

```bash
docker inspect --format '{{json .State.Health}}' "$(dc ps -q api)" | python3 -m json.tool
```

Check the public endpoint from the instance itself (bypasses DNS caching), then
from your own machine:

```bash
DOMAIN=$(grep '^DOMAIN=' .env.production | cut -d= -f2)
curl -fsS --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/v1/health/ready"
# {"status":"ok","service":"inorganic-chemistry-api",...}
```

Open `https://<DOMAIN>` in a browser and log in with each seeded account.
Review logs if anything is not healthy or the certificate is missing:

```bash
dc logs --tail=100 caddy api web mail-worker db
dc logs -f api                    # follow a single service
```

### 5. Routine operations

```bash
dc restart api                    # restart one service
dc down                           # stop the stack; volumes and data are kept
git pull --ff-only && dc build && dc up -d --wait   # update; migrate runs first
```

Back up the database before every update and on a schedule (see
[`docs/deployment.md`](docs/deployment.md#backups-and-recovery)); EBS snapshots
of the volume are a useful second layer. Never run `dc down -v`: it deletes the
PostgreSQL data and Caddy's certificates. Also install the daily
`purge-expired` cron job described in the same document.

## Nomenclature authoring and practice

The `/procvicovani/nazvoslovi` route reads `content/generated/nomenclature-runtime.json`. `content/data/nomenclature.json` holds 510 records from two content-owner seeds, and 469 are available for practice. From the first seed (126 entries), the owner released 86 core entries on 2026-09-23 after a cursory check; 40 remain drafts with unresolved review or scope decisions. The second seed (472 entries, stated by the owner to be verified from VŠCHT materials) added 383 released entries and one held for review; 86 of its keys already existed and two were omitted ([release ledger](docs/exec-plans/active/nomenclature-seed-2-review.md)). Both releases are owner authorizations: `owner-approved` is deliberately distinct from `reviewed` (chemistry-SME review). At the owner's request the practice screen no longer shows that distinction, so `reviewLevel` must stay accurate in the data. Each record offers one or both question directions, 812 prompts in total.

The first seed is a user-provided conversion of online [VŠCHT Praha nomenclature materials](https://e-learning.vscht.cz/echo/anorganika/nazvoslovi/index.html). Its formula/name pairs were compared with the [VŠCHT ECHO index](https://e-learning.vscht.cz/echo/anorganika/nazvoslovi/indexes/namesIndex.html): 59 of the released pairs match exactly; 26 do not appear there, and the index spells `NH4Cl` differently from the supplied name. [Other VŠCHT material](https://old.vscht.cz/fch/prikladnik/prikladnik/tab/termod.html) supports the supplied `NH4Cl` spelling. The ECHO project states a [CC BY-NC-ND 3.0 CZ license](https://e-learning.vscht.cz/echo/index.html); keep source attribution and review reuse terms before redistributing the underlying material outside this project.

After editing the authoring data, run:

```bash
pnpm --dir content import:nomenclature
pnpm --dir content import:nomenclature-2
pnpm --dir content generate:nomenclature
pnpm content:validate
```

The import commands report missing records without writing; `--write` adds them while preserving existing edits. The second importer follows the per-entry [decisions file](docs/exec-plans/active/nomenclature-seed-2-decisions.json). Both refuse a changed seed archive so source changes require a deliberate review. Generation and validation fail on invalid published content or a stale generated snapshot. A chemistry reviewer must verify each formula, Czech name, explanation, difficulty, context, and alias against traceable sources, resolve findings, and record reviewer and date before changing an entry to `reviewed`. Local practice and attempt history use IndexedDB; an unavailable store is reported in the UI. The IndexedDB schema is version 4, so a production rollout must first retire older clients that delete databases on `VersionError`.

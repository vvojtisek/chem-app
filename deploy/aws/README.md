# Frankfurt EC2 deployment

`stack.yaml` creates an Amazon Linux 2023 ARM64 `t4g.small`, a 30 GB encrypted
gp3 root volume, an Elastic IP, `vscht.vvojtisek.eu` A record, an SSM instance
role, and an HTTPS-only security group in `eu-central-1`. Choose either
`CreateVpc` to have the stack create a VPC, public subnet, internet gateway,
and route, or `ExistingVpc` to attach the host to a supplied public subnet.
Both modes use the existing Route 53 zone `Z0249271YTBB81ZE9N1U`. There is no
SSH rule or IPv6 address. The EBS volume is retained when the instance is
deleted; inspect and delete it separately when decommissioning.

The bootstrap installs Docker and the pinned Compose v2.39.4 plugin, adds 2 GB
swap, and starts an nftables source filter before Docker. RIPE NCC's extended
delegated feed supplies Czech allocated and assigned IPv4 ranges. The filter
runs in prerouting, before Docker's destination NAT, so it covers published
ports; it also blocks container access to EC2 metadata except for the fixed
Caddy address `172.30.0.2`. Caddy needs that access to use its narrowly scoped
Route 53 IAM permission for DNS-01 certificate issuance. The refresh timer runs
every six hours and retains the last successfully parsed CIDR set if the feed
fails. A new host fails closed if it has never obtained a valid set.

## Create the stack

For the two AWS CloudShell upload paths, see the
[CloudShell deployment instructions in the root README](../../README.md#1-create-the-ec2-infrastructure-from-aws-cloudshell).
The CloudFormation template and bootstrap scripts must be from the same
revision. After this change reaches `main`, use `BootstrapRef=main`; before
then use `BootstrapRef=feat/deploy-aws-vscht-frankfurt`.

For a local AWS CLI checkout, deploy with a new VPC:

```sh
aws cloudformation deploy \
  --region eu-central-1 \
  --stack-name chem-app-vscht \
  --template-file deploy/aws/stack.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides NetworkMode=CreateVpc BootstrapRef=main
```

To use an existing VPC, pass a public subnet with a route to an internet
gateway, VPC DNS support, and outbound HTTPS:

```sh
aws cloudformation deploy \
  --region eu-central-1 \
  --stack-name chem-app-vscht \
  --template-file deploy/aws/stack.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    NetworkMode=ExistingVpc \
    ExistingVpcId=vpc-REPLACE \
    ExistingPublicSubnetId=subnet-REPLACE \
    BootstrapRef=main
```

Check cloud-init and the firewall over SSM before app deployment:

```sh
aws ssm start-session --region eu-central-1 --target i-REPLACE
sudo tail -n 100 /var/log/chem-app-bootstrap.log
sudo systemctl status chem-cz-firewall docker chem-cz-refresh.timer
sudo nft list table inet chem_cz
docker compose version
```

The instance role includes `AmazonSSMManagedInstanceCore` so the SSM agent can
register and communicate with Systems Manager. It deliberately has no
`ssm:StartSession` permission: Caddy can read the instance role credentials
from EC2 metadata for its Route 53 DNS challenge, so a session permission on
the role would let a compromised Caddy container open a root-capable shell on
this host. Start sessions from CloudShell or a workstation whose own AWS
credentials allow `ssm:StartSession` on the instance, not from a process on the
instance. When updating an existing stack that still has the
`StartSessionOnStackHost` policy, deploy the new template with
`CAPABILITY_IAM` so CloudFormation removes it.

The CloudFormation stack may report complete before cloud-init finishes. The
instance ID and Elastic IP are stack outputs. Check that the DNS A record points
to that address and that there is no AAAA record for this name.

## Configure and start the app

Use SSM to create `/srv/chem-app/.env.production` from
`.env.production.example` with mode `0600`. Set `DOMAIN=vscht.vvojtisek.eu`,
`ACME_EMAIL`, unique PostgreSQL owner/runtime passwords, `SECRET_KEY`, seed
account passwords, and working STARTTLS SMTP settings. Keep credentials out of
CloudFormation parameters, user data, shell history, and Git. The API requires
SMTP configuration in production; obtain a relay and verified sender before
starting. Complete the [privacy notice release checklist](../../docs/privacy-notice-release-checklist.md)
before creating learner accounts.

The app checkout and AWS overlay must both be present. Once this directory is
on `main`, update and start the current `main` revision as follows:

```sh
cd /srv/chem-app
git fetch origin main
git switch main
git pull --ff-only origin main
docker compose --env-file .env.production \
  -f docker-compose.prod.yml -f deploy/aws/compose.yaml build
docker compose --env-file .env.production \
  -f docker-compose.prod.yml -f deploy/aws/compose.yaml pull --ignore-buildable
docker compose --env-file .env.production \
  -f docker-compose.prod.yml -f deploy/aws/compose.yaml up -d db
docker compose --env-file .env.production \
  -f docker-compose.prod.yml -f deploy/aws/compose.yaml up -d --wait migrate
docker compose --env-file .env.production \
  -f docker-compose.prod.yml -f deploy/aws/compose.yaml --profile setup run --rm seed
docker compose --env-file .env.production \
  -f docker-compose.prod.yml -f deploy/aws/compose.yaml up -d
```

`build` builds only the AWS Caddy image; the `api` and `web` images are pulled
from GHCR (`stable` tag, see [docs/releasing.md](../../docs/releasing.md)).
Watchtower applies later releases on request; it needs
`WATCHTOWER_HTTP_API_TOKEN` in `.env.production` (`openssl rand -hex 32`).

### Switching a host that builds images locally

A host deployed before ADR 0012 builds its images and runs `migrate` as a
one-shot task. Switch it once, after a release has published both images and
both GHCR packages are public:

1. Create and verify a `pg_dump` backup as in the runbook.
2. Add `WATCHTOWER_HTTP_API_TOKEN` to `.env.production`.
3. Run the commands above from `git pull` onward, skipping the `seed` step.
   `up -d` replaces the locally built containers with the pulled images,
   starts `migrate` as a long-running service and starts `watchtower`.
4. Check that every service, including `migrate` and `watchtower`, is
   `Up … (healthy)`.

Remove `SEED_*` entries from `.env.production` after successful seeding. Keep
the database volume, Caddy data volume, and `SECRET_KEY` across updates.
Use [the deployment runbook](../../docs/deployment.md) for backup, migration,
and account recovery procedures. The AWS Compose overlay builds Caddy 2.10.2
with the pinned Route 53 plugin v1.6.2. It publishes only TCP 443 and uses
DNS-01, since a Czech-only ingress rule prevents public ACME HTTP/TLS-ALPN
validation from working reliably.

## Verify

```sh
cd /srv/chem-app
docker compose --env-file .env.production \
  -f docker-compose.prod.yml -f deploy/aws/compose.yaml ps
sudo nft list set inet chem_cz allowed
```

From a Czech network, run `curl -fsSI https://vscht.vvojtisek.eu` and verify
HTTPS. Also verify a connection refusal or timeout
from a non-Czech network. Verify login, an account invitation email, and API
readiness. Check the periodic refresh with `systemctl status
chem-cz-refresh.timer` and `journalctl -u chem-cz-refresh.service`. If the
RIPE feed is unavailable during a refresh, the previous set remains active.

An instance stop/start retains the Elastic IP association, EBS root volume,
and DNS record. The stack creates an Amazon Data Lifecycle Manager policy that
snapshots the root volume daily at 02:30 UTC and keeps 14 snapshots. The
policy selects instances by the `chem-app-backup` tag. Snapshots are
crash-consistent and live in the same account and region, so they do not
replace a tested logical dump copied off the host (see the runbook). The stack
creates no monitoring or SMTP relay; configure those before relying on the
service for production use. Updating an existing stack adds the policy and a
service role, so deploy with `CAPABILITY_IAM`. To restore, create a volume from
a snapshot and attach it to a replacement instance; restoration has not been
rehearsed.

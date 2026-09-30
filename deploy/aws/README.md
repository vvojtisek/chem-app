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
before inviting users to register.

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
  -f docker-compose.prod.yml -f deploy/aws/compose.yaml up -d db
docker compose --env-file .env.production \
  -f docker-compose.prod.yml -f deploy/aws/compose.yaml run --rm migrate
docker compose --env-file .env.production \
  -f docker-compose.prod.yml -f deploy/aws/compose.yaml --profile setup run --rm seed
docker compose --env-file .env.production \
  -f docker-compose.prod.yml -f deploy/aws/compose.yaml up -d
```

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
from a non-Czech network. Verify login, account verification email, and API
readiness. Check the periodic refresh with `systemctl status
chem-cz-refresh.timer` and `journalctl -u chem-cz-refresh.service`. If the
RIPE feed is unavailable during a refresh, the previous set remains active.

An instance stop/start retains the Elastic IP association, EBS root volume,
and DNS record. The stack creates no external database backup, monitoring, or
SMTP relay; configure those before relying on the service for production use.

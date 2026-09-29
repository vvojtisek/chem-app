#!/usr/bin/env bash
set -euo pipefail

test "$(id -u)" -eq 0
install -m 700 /srv/chem-app/deploy/aws/refresh-cz-ranges.sh /usr/local/sbin/refresh-cz-ranges
install -d -m 755 /etc/systemd/system/docker.service.d
cat >/etc/systemd/system/chem-cz-firewall.service <<'EOF'
[Unit]
Description=Refresh Czech IPv4 set and install kernel ingress filter
Wants=network-online.target
After=network-online.target
Before=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/refresh-cz-ranges
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
cat >/etc/systemd/system/chem-cz-refresh.service <<'EOF'
[Unit]
Description=Refresh Czech IPv4 allocation set
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/refresh-cz-ranges
EOF
cat >/etc/systemd/system/chem-cz-refresh.timer <<'EOF'
[Unit]
Description=Refresh Czech IPv4 allocations every six hours

[Timer]
OnBootSec=15min
OnUnitActiveSec=6h
Persistent=true

[Install]
WantedBy=timers.target
EOF
cat >/etc/systemd/system/docker.service.d/chem-cz.conf <<'EOF'
[Unit]
Requires=chem-cz-firewall.service
After=chem-cz-firewall.service
EOF

if ! swapon --show=NAME | grep -qx /swapfile; then
  if ! test -e /swapfile; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab

systemctl daemon-reload
systemctl enable --now chem-cz-firewall.service
systemctl enable --now chem-cz-refresh.timer
systemctl enable --now docker.service
docker compose version

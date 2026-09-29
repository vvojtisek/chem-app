#!/usr/bin/env bash
set -euo pipefail

state_dir=/var/lib/chem-cz
feed=https://ftp.ripe.net/ripe/stats/delegated-ripencc-extended-latest
install -d -m 700 "$state_dir"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

if curl --fail --silent --show-error --location --retry 3 --max-time 45 "$feed" -o "$work/delegated"; then
  python3 - "$work/delegated" "$work/cidrs" <<'PY' || true
import ipaddress
import sys

ranges = []
with open(sys.argv[1], encoding="ascii") as source:
    for line in source:
        fields = line.strip().split("|")
        if len(fields) < 7 or fields[0] != "ripencc" or fields[1] != "CZ" or fields[2] != "ipv4":
            continue
        if fields[6] not in ("allocated", "assigned"):
            continue
        start = ipaddress.IPv4Address(fields[3])
        count = int(fields[4])
        if count < 1 or int(start) + count - 1 > 0xFFFFFFFF:
            raise ValueError("invalid Czech IPv4 allocation")
        end = ipaddress.IPv4Address(int(start) + count - 1)
        ranges.extend(ipaddress.summarize_address_range(start, end))

collapsed = list(ipaddress.collapse_addresses(ranges))
if len(collapsed) < 50:
    raise ValueError(f"unexpected Czech CIDR count: {len(collapsed)}")
with open(sys.argv[2], "w", encoding="ascii") as output:
    output.write("\n".join(map(str, collapsed)) + "\n")
PY
fi

if ! test -s "$work/cidrs" && test -s "$state_dir/cidrs"; then
  cp "$state_dir/cidrs" "$work/cidrs"
fi
if ! test -s "$work/cidrs"; then
  echo 'RIPE feed unavailable and no last-good CIDR set exists' >&2
  exit 1
fi

if ! nft list table inet chem_cz >/dev/null 2>&1; then
  public_iface=$(ip -4 route show default | awk '/^default / { print $5; exit }')
  test -n "$public_iface"
  cat > "$work/table.nft" <<EOF
add table inet chem_cz
add set inet chem_cz allowed { type ipv4_addr; flags interval; auto-merge; }
add chain inet chem_cz ingress { type filter hook prerouting priority -300; policy accept; }
add rule inet chem_cz ingress iifname "$public_iface" tcp dport 443 ip saddr != @allowed drop
add rule inet chem_cz ingress iifname "$public_iface" udp dport 443 ip saddr != @allowed drop
add chain inet chem_cz host_input { type filter hook input priority -300; policy drop; }
add rule inet chem_cz host_input iifname lo accept
add rule inet chem_cz host_input ct state established,related accept
add rule inet chem_cz host_input ip protocol icmp icmp type { destination-unreachable, time-exceeded, parameter-problem } accept
add chain inet chem_cz metadata { type filter hook forward priority -300; policy accept; }
add rule inet chem_cz metadata ip daddr 169.254.169.254 ip saddr != 172.30.0.2 drop
EOF
  nft -f "$work/table.nft"
fi

python3 - "$work/cidrs" "$work/update.nft" <<'PY'
import sys

with open(sys.argv[1], encoding="ascii") as source:
    cidrs = [line.strip() for line in source if line.strip()]
if len(cidrs) < 50:
    raise ValueError("refusing a suspiciously small Czech CIDR set")
with open(sys.argv[2], "w", encoding="ascii") as output:
    output.write("flush set inet chem_cz allowed\n")
    output.write("add element inet chem_cz allowed { " + ", ".join(cidrs) + " }\n")
PY
nft -f "$work/update.nft"
install -m 600 "$work/cidrs" "$state_dir/cidrs.new"
mv -f "$state_dir/cidrs.new" "$state_dir/cidrs"

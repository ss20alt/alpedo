#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run with sudo: sudo bash ops/restrict-firewall.sh" >&2
  exit 1
fi

backup_dir="/root/firewall-backups/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 700 "$backup_dir"
iptables-save > "$backup_dir/rules.v4.before"
ip6tables-save > "$backup_dir/rules.v6.before"
cp -a /etc/iptables/rules.v4 "$backup_dir/rules.v4.persistent.before"
cp -a /etc/iptables/rules.v6 "$backup_dir/rules.v6.persistent.before"

# Remove direct ingress exceptions for app internals, the database and unused HTTPS.
for port in 3000 8080 443 5432; do
  while rule="$(iptables -S INPUT | awk -v port="$port" '
    $1 == "-A" && $2 == "INPUT" && $0 ~ /-j ACCEPT/ {
      for (i = 1; i < NF; i++) if ($i == "--dport" && $(i + 1) == port) { print; exit }
    }
  ')" && [[ -n "$rule" ]]; do
    read -r -a parts <<< "$rule"
    iptables -D INPUT "${parts[@]:2}"
  done
done

# Keep the existing IPv4 policy and provider metadata rules, while removing those
# same exceptions from the persistent rules loaded at boot.
tmp_rules="$(mktemp /etc/iptables/rules.v4.XXXXXX)"
awk '
  $1 == "-A" && $2 == "INPUT" && $0 ~ /-j ACCEPT/ {
    for (i = 1; i < NF; i++) {
      if ($i == "--dport" && ($(i + 1) == "3000" || $(i + 1) == "8080" || $(i + 1) == "443" || $(i + 1) == "5432")) next
    }
  }
  { print }
' /etc/iptables/rules.v4 > "$tmp_rules"
install -o root -g root -m 600 "$tmp_rules" /etc/iptables/rules.v4
rm -f "$tmp_rules"

# There is no configured public IPv6 service on this host. Keep local and
# established traffic plus ICMPv6, and deny new inbound IPv6 connections.
ip6tables -F INPUT
ip6tables -F FORWARD
ip6tables -P INPUT DROP
ip6tables -P FORWARD DROP
ip6tables -A INPUT -i lo -j ACCEPT
ip6tables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
ip6tables -A INPUT -p ipv6-icmp -j ACCEPT
ip6tables-save > /etc/iptables/rules.v6
chmod 600 /etc/iptables/rules.v6

echo "Firewall rules updated. Allowed IPv4 ingress: SSH 22, HTTP 80, Alpedo proxy 3001. New IPv6 ingress is denied."
echo "Backup: $backup_dir"
iptables -S INPUT
ip6tables -S INPUT

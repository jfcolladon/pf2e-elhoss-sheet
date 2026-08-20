#!/bin/sh
# Endurece SSH en la VM (fail2ban + sshd). Ejecutar como root/sudo.
set -eu
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y fail2ban
install -d /etc/fail2ban/jail.d
cat >/etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 1h
findtime = 10m
EOF
systemctl enable --now fail2ban
SSHD=/etc/ssh/sshd_config
grep -q '^PasswordAuthentication' "$SSHD" && sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD" || echo 'PasswordAuthentication no' >>"$SSHD"
grep -q '^PermitEmptyPasswords' "$SSHD" && sed -i 's/^PermitEmptyPasswords.*/PermitEmptyPasswords no/' "$SSHD" || echo 'PermitEmptyPasswords no' >>"$SSHD"
grep -q '^KbdInteractiveAuthentication' "$SSHD" && sed -i 's/^KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' "$SSHD" || echo 'KbdInteractiveAuthentication no' >>"$SSHD"
if systemctl reload ssh 2>/dev/null; then
  true
else
  systemctl reload sshd
fi
echo HARDEN_OK

#!/bin/bash
set -eu
cd /opt/relay/executor
mkdir -p /etc/systemd/system/relay-executor.service.d
cat > /etc/systemd/system/relay-executor.service.d/metadata.conf <<'UNIT'
[Service]
ExecStartPre=/usr/bin/bash -c '/usr/sbin/iptables -C DOCKER-USER -d 169.254.0.0/16 -j DROP || /usr/sbin/iptables -I DOCKER-USER -d 169.254.0.0/16 -j DROP'
UNIT
systemctl daemon-reload
# Bound Docker build memory pressure on a 2 GiB demo host.
if [ ! -f /var/lib/relay/build.swap ]; then
  fallocate -l 2G /var/lib/relay/build.swap
  chmod 600 /var/lib/relay/build.swap
  mkswap /var/lib/relay/build.swap
fi
if ! swapon --show=NAME --noheadings | grep -qx /var/lib/relay/build.swap; then
  swapon /var/lib/relay/build.swap
fi
docker build -t relay-sandbox:0.1 .
systemctl enable relay-executor.service
systemctl restart relay-executor.service
for task_attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8788/health; then exit 0; fi
  sleep 1
done
exit 1

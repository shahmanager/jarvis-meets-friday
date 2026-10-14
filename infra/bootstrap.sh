dnf install -y docker nodejs22 nodejs22-npm amazon-cloudwatch-agent python3
systemctl enable --now docker amazon-ssm-agent
mkdir -p /opt/relay /var/lib/relay
chmod 700 /var/lib/relay
touch /var/log/relay-executor.log
chmod 600 /var/log/relay-executor.log
task_secret=$(aws ssm get-parameter --name "$SECRET_PATH" --with-decryption --query Parameter.Value --output text --region "$AWS_DEFAULT_REGION")
umask 077
printf '%s\n' "EXECUTOR_SECRET=$task_secret" "ARTIFACT_BUCKET=$ARTIFACT_BUCKET" "AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION" > /etc/relay-executor.env
unset task_secret
iptables -I DOCKER-USER -d 169.254.0.0/16 -j DROP
cat > /etc/systemd/system/relay-executor.service <<'UNIT'
[Unit]
Description=Relay trusted executor supervisor
After=docker.service network-online.target
Requires=docker.service
[Service]
WorkingDirectory=/opt/relay/executor
EnvironmentFile=/etc/relay-executor.env
ExecStartPre=/usr/bin/bash -c '/usr/sbin/iptables -C DOCKER-USER -d 169.254.0.0/16 -j DROP || /usr/sbin/iptables -I DOCKER-USER -d 169.254.0.0/16 -j DROP'
ExecStart=/usr/bin/node-22 /opt/relay/executor/server.mjs
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
StandardOutput=append:/var/log/relay-executor.log
StandardError=append:/var/log/relay-executor.log
[Install]
WantedBy=multi-user.target
UNIT
cat > /etc/systemd/system/relay-auto-stop.service <<'UNIT'
[Unit]
Description=Stop the Relay demo VM to conserve credits
[Service]
Type=oneshot
ExecStart=/usr/sbin/shutdown -h now
UNIT
AUTO_STOP_DURATION=$(printf '%smin' "$AUTO_STOP_MINUTES")
cat > /etc/systemd/system/relay-auto-stop.timer <<UNIT
[Unit]
Description=Relay demo runtime limit
[Timer]
OnBootSec=$AUTO_STOP_DURATION
Unit=relay-auto-stop.service
[Install]
WantedBy=timers.target
UNIT
cat > /opt/aws/amazon-cloudwatch-agent/etc/relay.json <<JSON
{"logs":{"logs_collected":{"files":{"collect_list":[{"file_path":"/var/log/relay-executor.log","log_group_name":"$LOG_GROUP","log_stream_name":"{instance_id}"},{"file_path":"/var/log/cloud-init-output.log","log_group_name":"$LOG_GROUP","log_stream_name":"bootstrap-{instance_id}"}]}}}}
JSON
systemctl daemon-reload
systemctl enable --now relay-auto-stop.timer
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/relay.json -s

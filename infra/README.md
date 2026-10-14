# AWS executor

The deployer creates a dedicated Relay stack using an existing default VPC and public subnet. It never reuses an unrelated running VM. All ingress is closed; Systems Manager manages the host. A future outbound HTTPS tunnel connects the Worker to the loopback executor. No SSH key, load balancer, NAT gateway, Kubernetes cluster, GPU, or Cloudflare paid container service is required.

The instance role reads its own encrypted executor secret and deployment bundle, reads/writes its artifact prefix, and sends logs to its own CloudWatch group. It has the standard SSM managed-instance policy. IMDSv2 with a hop limit of one and a Docker metadata-address firewall rule keep instance-role access on the supervisor host. Model-written code runs in a separate non-root, network-disabled container without the Docker socket, keys, or host files.

The provisioner currently targets an active AWS Free plan with at least $10 credit remaining and an eligible `t3.small` instance. This is an intentional account-specific ceiling; other plans or larger hosts need a separate cost review. Standard CPU credits avoid surplus CPU charges but can throttle sustained builds. One browser workspace is permitted at a time. The VM stops two hours after every boot; stopping retains its encrypted disk, which continues using storage credits. S3 and logs also remain. Important text artifacts exported to the private versioned bucket survive VM termination; scratch Docker workspace files do not.

```powershell
# Generate and validate, without provisioning:
./infra/deploy-aws.ps1
# Provision the dedicated stack and start installation:
./infra/deploy-aws.ps1 -Provision
```

The generator writes the CloudFormation JSON to `work/aws-executor.cfn.json`. Local `cfn-lint` and `cfn-guard` tools, when present under `work/`, run before deployment. AWS pre-deployment validation remains enabled. The first deployment passed both tools and the checked-in security rules. `work/aws-deployment.json` records resource identifiers and the SSM installation command ID without secret values.

The executor secret comes from ignored `.dev.vars` and is uploaded as an SSM SecureString parameter. It is fetched at boot using the host role; it is absent from the CloudFormation template and user data. Model-provider API keys are not needed on this VM. Do not put credentials in source archives.

```powershell
aws ssm get-command-invocation --profile relay-project --region ap-south-1 --command-id INSTALL_COMMAND --instance-id INSTANCE_ID --no-cli-pager
aws ec2 start-instances --profile relay-project --region ap-south-1 --instance-ids INSTANCE_ID --no-cli-pager
aws ec2 stop-instances --profile relay-project --region ap-south-1 --instance-ids INSTANCE_ID --no-cli-pager
```

On Windows, set `AWS_CLI_OUTPUT_ENCODING=UTF-8` if Unicode log output causes an encoding error. Use your configured profile and actual identifiers from the deployment record. Starting the VM restarts the enabled executor service and the two-hour timer. It does not require interactive login inside the VM because AWS APIs use its instance role.

To connect private S3 text artifacts to the Worker, set `ARTIFACT_STORAGE` to `executor` and configure its HTTPS `EXECUTOR_URL`. The supervisor uses the host role for S3 calls; the Worker stores artifact references and mediates authenticated downloads. Screenshots are stored separately in Durable Object SQLite and passed to compatible main models as image inputs, retaining only the latest two images in model context.

An HTTPS transport still needs to be connected after Cloudflare deployment authentication is available. The loopback endpoint is deliberately unreachable directly from the public Internet. This is not a completed public agent deployment until that transport and real model inference have been verified.

Run `infra/verify-executor.py` on the host through SSM with its protected environment file loaded. It exercises real Docker files, root filesystem restrictions, non-root Python, credential separation, metadata/network denial, private S3 upload/download, Chromium reading and screenshots, URL restrictions, and cancellation using synthetic data. Never publish environment-file contents or paste its bearer token into chat.

Official references: [Node.js on Amazon Linux 2023](https://docs.aws.amazon.com/linux/al2023/ug/nodejs.html), [EC2 CloudFormation properties](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-ec2-instance.html), [AWS Free Tier eligibility](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html), [AWS CLI encoding configuration](https://docs.aws.amazon.com/cli/latest/topic/config-vars.html).

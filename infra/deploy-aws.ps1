param(
  [string]$Profile = 'relay-project',
  [string]$Region = 'ap-south-1',
  [ValidatePattern('^relay-[a-z0-9-]{1,40}$')][string]$Stack = 'relay-executor-demo',
  [switch]$Provision,
  [switch]$UpdateCode
)
$ErrorActionPreference = 'Stop'
$env:AWS_CLI_OUTPUT_ENCODING = 'UTF-8'
$taskRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRoot
function Invoke-RelayAws {
  param([string[]]$TaskArguments)
  $taskResult = & aws @TaskArguments --profile $Profile --region $Region --no-cli-auto-prompt --no-cli-pager
  if ($LASTEXITCODE -ne 0) { throw "AWS command failed: $($TaskArguments[0]) $($TaskArguments[1])" }
  return $taskResult
}
node infra/aws-template.mjs
if ($LASTEXITCODE -ne 0) { throw 'Template generation failed.' }
Invoke-RelayAws @('cloudformation','validate-template','--template-body','file://work/aws-executor.cfn.json') | Out-Null
if (Test-Path work/cfn-tools/Scripts/cfn-lint.exe) {
  & work/cfn-tools/Scripts/cfn-lint.exe work/aws-executor.cfn.json
  if ($LASTEXITCODE -ne 0) { throw 'CloudFormation schema validation failed.' }
}
$taskGuard = Get-ChildItem work/cfn-guard -Recurse -Filter cfn-guard.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if ($taskGuard) {
  & $taskGuard.FullName validate --data work/aws-executor.cfn.json --rules infra/security.guard --show-summary all
  if ($LASTEXITCODE -ne 0) { throw 'Infrastructure security checks failed.' }
}
if (-not $Provision -and -not $UpdateCode) {
  Write-Output 'Template validated. Add -Provision to create a dedicated VM, private bucket, role and log group. No resources were created.'
  exit 0
}
if ($Provision) {
$taskPlan = Invoke-RelayAws @('freetier','get-account-plan-state','--output','json') | ConvertFrom-Json
if ($taskPlan.accountPlanType -ne 'FREE' -or $taskPlan.accountPlanStatus -ne 'ACTIVE' -or [decimal]$taskPlan.accountPlanRemainingCredits.amount -lt 10) { throw 'This demo provisioner requires an active Free plan with at least $10 credits. Review other plans separately.' }
$taskVpc = Invoke-RelayAws @('ec2','describe-vpcs','--filters','Name=is-default,Values=true','--query','Vpcs[0].VpcId','--output','text')
$taskSubnet = Invoke-RelayAws @('ec2','describe-subnets','--filters',"Name=vpc-id,Values=$taskVpc",'Name=default-for-az,Values=true','--query','Subnets[0].SubnetId','--output','text')
if ($taskVpc -eq 'None' -or $taskSubnet -eq 'None') { throw 'A default VPC and public subnet are required by this demo.' }
$taskSecretLine = Get-Content .dev.vars | Where-Object { $_ -match '^EXECUTOR_SECRET=' } | Select-Object -First 1
if (-not $taskSecretLine) { throw 'Set EXECUTOR_SECRET in the ignored .dev.vars file.' }
$taskSecret = ($taskSecretLine -split '=',2)[1].Trim().Trim('"')
if ($taskSecret -notmatch '^[a-zA-Z0-9_-]{24,200}$') { throw 'Use a 24–200 character alphanumeric executor secret for this environment-file deployment.' }
$taskParameterFile = Join-Path $taskRoot 'work/executor.secret.json'
try {
  @{Name="/relay/$Stack/executor-secret";Value=$taskSecret;Type='SecureString';Overwrite=$true} | ConvertTo-Json | Set-Content -LiteralPath $taskParameterFile -Encoding utf8
  Invoke-RelayAws @('ssm','put-parameter','--cli-input-json','file://work/executor.secret.json') | Out-Null
} finally {
  $taskSecret = $null
  if (Test-Path -LiteralPath $taskParameterFile) { Remove-Item -LiteralPath $taskParameterFile }
}
# Change-set execution is deliberately tied to -Provision; never disable AWS pre-deployment validation.
Invoke-RelayAws @('cloudformation','deploy','--template-file','work/aws-executor.cfn.json','--stack-name',$Stack,'--parameter-overrides',"VpcId=$taskVpc","SubnetId=$taskSubnet",'--capabilities','CAPABILITY_IAM','--tags','Project=Relay','--no-fail-on-empty-changeset')
}
$taskStack = Invoke-RelayAws @('cloudformation','describe-stacks','--stack-name',$Stack,'--query','Stacks[0]','--output','json') | ConvertFrom-Json
if (-not ($taskStack.Tags | Where-Object { $_.Key -eq 'Project' -and $_.Value -eq 'Relay' })) { throw 'Refusing to update a stack without the Relay project tag.' }
$taskOutputs = @{}
foreach ($taskOutput in $taskStack.Outputs) { $taskOutputs[$taskOutput.OutputKey] = $taskOutput.OutputValue }
$taskBundleFiles = @('executor/Dockerfile','executor/package.json','executor/package-lock.json','executor/server.mjs','executor/policy.mjs','executor/network.mjs','executor/artifacts.mjs','executor/browser.mjs','executor/browser-client.mjs','executor/files.py','infra/start-executor.sh','infra/verify-executor.py')
tar -czf work/executor-bundle.tar.gz @taskBundleFiles
if ($LASTEXITCODE -ne 0) { throw 'Executor archive failed.' }
Invoke-RelayAws @('s3','cp','work/executor-bundle.tar.gz',"s3://$($taskOutputs.ArtifactBucket)/deployment/executor.tar.gz",'--sse','AES256') | Out-Null
$taskInstance = $taskOutputs.InstanceId
for ($taskAttempt=0; $taskAttempt -lt 40; $taskAttempt++) {
  $taskOnline = Invoke-RelayAws @('ssm','describe-instance-information','--filters',"Key=InstanceIds,Values=$taskInstance",'--query','InstanceInformationList[0].PingStatus','--output','text')
  if ($taskOnline -eq 'Online') { break }
  Start-Sleep -Seconds 5
}
if ($taskOnline -ne 'Online') { throw 'VM exists but Systems Manager is not online yet.' }
$taskInstallCommands = @('set -eu','cloud-init status --wait',"aws s3 cp s3://$($taskOutputs.ArtifactBucket)/deployment/executor.tar.gz /var/lib/relay/executor.tar.gz --region $Region",'tar -xzf /var/lib/relay/executor.tar.gz -C /opt/relay','bash /opt/relay/infra/start-executor.sh')
$taskInstallCommands += @('set -a; . /etc/relay-executor.env; set +a','python3 /opt/relay/infra/verify-executor.py')
@{commands=$taskInstallCommands;executionTimeout=@('1800')} | ConvertTo-Json -Depth 4 | Set-Content work/install-command.json -Encoding utf8
$taskCommand = Invoke-RelayAws @('ssm','send-command','--instance-ids',$taskInstance,'--document-name','AWS-RunShellScript','--parameters','file://work/install-command.json','--timeout-seconds','1800','--query','Command.CommandId','--output','text')
@{Stack=$Stack;Region=$Region;InstanceId=$taskInstance;ArtifactBucket=$taskOutputs.ArtifactBucket;LogGroup=$taskOutputs.LogGroup;InstallCommandId=$taskCommand;AutoStopMinutes=120} | ConvertTo-Json | Set-Content work/aws-deployment.json -Encoding utf8
Write-Output "Deployment/update queued. Installation and verification command: $taskCommand. VM: $taskInstance. Automatic stop: two hours after each boot. See work/aws-deployment.json."

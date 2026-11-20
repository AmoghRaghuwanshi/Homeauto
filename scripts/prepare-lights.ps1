param([string]$BrokerIP = '172.20.10.5', [string]$SSID, [switch]$MotionSensor)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $SSID) {
    $ssidLine = netsh wlan show interfaces | Select-String '^\s+SSID\s+:' | Select-Object -First 1
    if (-not $ssidLine) { throw 'Connect the laptop to the hotspot or pass -SSID explicitly.' }
    $SSID = ($ssidLine.Line -split ':',2)[1].Trim()
}
if (-not ((Test-Path -LiteralPath 'C:\Program Files\mosquitto\mosquitto.exe') -or (Test-Path -LiteralPath (Join-Path $projectRoot '.local\tools\mosquitto\mosquitto.exe')))) { throw 'Install the Windows broker from https://mosquitto.org/download/ first.' }
$folder = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$securePassword = Read-Host 'Mobile hotspot Wi-Fi password (hidden)' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$inputFile = Join-Path $folder 'lights-provisioning.json'
try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $json = @{ board='lights'; ssid=$SSID; wifi_password=$plainPassword; broker_ip=$BrokerIP; motion_enabled=[bool]$MotionSensor } | ConvertTo-Json
    [IO.File]::WriteAllText($inputFile, $json, (New-Object Text.UTF8Encoding($false)))
    & node (Join-Path $PSScriptRoot 'setup-hardware.js') $inputFile
    if ($LASTEXITCODE -ne 0) { throw 'Hardware provisioning did not complete.' }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    $plainPassword = $null
    if (Test-Path -LiteralPath $inputFile) { Remove-Item -LiteralPath $inputFile }
}

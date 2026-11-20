param([switch]$NoBrowser, [ValidateSet('Simulation','Hardware')][string]$Mode = 'Simulation', [string]$GatewayFile, [string]$HardwareConfig)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$logDirectory = Join-Path $projectRoot '.local\launcher'
$simulation = $Mode -eq 'Simulation'
$servicePort = if ($simulation) { 3002 } else { 3001 }
$homeUrl = "http://127.0.0.1:$servicePort"
$startPage = if ($simulation) { '/' } else { '/modules' }
$logName = if ($simulation) { 'simulation' } else { 'homeauto' }

function Test-ServiceReady([string]$Kind) {
    try {
        if ($Kind -eq 'home') {
            $runtime = Invoke-RestMethod -Uri "$homeUrl/api/runtime" -TimeoutSec 2
            return $runtime.mode -eq 'local' -and $runtime.simulation -eq $simulation
        }
        return $false
    } catch { return $false }
}

function Assert-PortAvailable([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $connected = $client.ConnectAsync('127.0.0.1', $Port)
        if ($connected.Wait(500) -and $client.Connected) {
            throw "Port $Port is occupied by a different service. Close that service, then run the launcher again."
        }
    } catch [System.AggregateException] {
        # Connection refused means the loopback port is available.
    } finally { $client.Dispose() }
}

function Get-SupportedNode {
    $candidates = @($env:HOMEAUTO_NODE)
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($command) { $candidates += $command.Source }
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            $version = & $candidate --version
            if ($LASTEXITCODE -eq 0 -and $version -match '^v(22|26)\.') { return $candidate }
        }
    }
    throw 'Node.js 22 or 26 is required. Install a tested version, or set HOMEAUTO_NODE to its node.exe path.'
}

function Wait-Service([string]$Kind, $Process, [string]$ErrorLog) {
    $deadline = [DateTime]::UtcNow.AddSeconds(45)
    do {
        if (Test-ServiceReady $Kind) { return }
        $Process.Refresh()
        if ($Process.HasExited) {
            $details = if (Test-Path -LiteralPath $ErrorLog) { (Get-Content -LiteralPath $ErrorLog -Tail 8) -join [Environment]::NewLine } else { '' }
            throw "$Kind server stopped during startup. $details"
        }
        Start-Sleep -Milliseconds 300
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "$Kind server did not become ready within 45 seconds. See $ErrorLog."
}

$mutex = New-Object System.Threading.Mutex($false, "Local\HomeAutoLocalLauncher$Mode")
$ownsMutex = $false
$exitStatus = 0
try {
    try { $ownsMutex = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $ownsMutex = $true }
    if (-not $ownsMutex) { Write-Host 'HomeAuto is already starting. Please wait for its browser pages.'; exit 0 }
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    Write-Host "Starting HomeAuto $Mode..."
    if (-not $simulation) {
        $savedGatewayPath = Join-Path $projectRoot '.local\gateway-path.txt'
        if (-not $GatewayFile -and (Test-Path -LiteralPath $savedGatewayPath)) { $GatewayFile = (Get-Content -LiteralPath $savedGatewayPath -Raw).Trim() }
        if (-not $HardwareConfig -and (Test-Path -LiteralPath (Join-Path $projectRoot '.local\hardware\hub.json'))) { $HardwareConfig = Join-Path $projectRoot '.local\hardware\hub.json' }
        if ($HardwareConfig) {
            $settings = Get-Content -LiteralPath $HardwareConfig -Raw | ConvertFrom-Json
            foreach ($property in $settings.PSObject.Properties) {
                if ($property.Name -notmatch '^HOMEAUTO_(MQTT_(ENABLED|BROKER|USERNAME|PASSWORD|CA)|DOOR_ENABLED|REMOTE_(DOOR|LIGHTS)_ENABLED|SECURE_GATEWAY_APPROVED)$') { throw "Unsupported hardware setting: $($property.Name)" }
                [Environment]::SetEnvironmentVariable($property.Name, [string]$property.Value, 'Process')
            }
            $brokerConfig = Join-Path $projectRoot '.local\hardware\mosquitto.conf'
            $brokerExe = Join-Path $projectRoot '.local\tools\mosquitto\mosquitto.exe'
            if (-not (Test-Path -LiteralPath $brokerExe)) { $brokerExe = 'C:\Program Files\mosquitto\mosquitto.exe' }
            if ($settings.HOMEAUTO_MQTT_BROKER -eq 'mqtts://127.0.0.1:8883' -and (Test-Path -LiteralPath $brokerConfig) -and (Test-Path -LiteralPath $brokerExe)) {
                $probe = New-Object Net.Sockets.TcpClient
                $brokerRunning = $false
                try { $brokerRunning = $probe.ConnectAsync('127.0.0.1',8883).Wait(500) -and $probe.Connected } catch {} finally { $probe.Dispose() }
                if (-not $brokerRunning) {
                    Start-Process -FilePath $brokerExe -ArgumentList @('-c',('"'+$brokerConfig+'"')) -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory 'broker.log') -RedirectStandardError (Join-Path $logDirectory 'broker-error.log') | Out-Null
                }
            }
        }
        if ($GatewayFile) {
            $GatewayFile = (Resolve-Path -LiteralPath $GatewayFile).Path
            Set-Content -LiteralPath $savedGatewayPath -Value $GatewayFile
        }
    }
    if (-not (Test-ServiceReady 'home')) {
        Assert-PortAvailable $servicePort
        $node = Get-SupportedNode
        $serverDirectory = Join-Path $projectRoot 'server'
        if (-not (Test-Path -LiteralPath (Join-Path $serverDirectory 'node_modules\express\package.json'))) {
            throw "Dependencies are missing. Run npm ci --ignore-scripts --prefix server from $projectRoot, then run this launcher again."
        }
        $errorLog = Join-Path $logDirectory "$logName-error.log"
        $env:HOMEAUTO_PORT = [string]$servicePort
        $env:HOMEAUTO_SIMULATION_PORT = [string]$servicePort
        $env:HOMEAUTO_CAMERA_MODE = 'disabled'
        $entryPoint = if ($simulation) { 'scripts/simulation.js' } else { 'server.js' }
        $launchArguments = @($entryPoint)
        if (-not $simulation -and $GatewayFile) { $launchArguments = @('scripts/with-gateway.js', ('"' + $GatewayFile + '"')) }
        $process = Start-Process -FilePath $node -ArgumentList $launchArguments -WorkingDirectory $serverDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory "$logName.log") -RedirectStandardError $errorLog -PassThru
        Wait-Service 'home' $process $errorLog
    }
    Write-Host "HomeAuto: $homeUrl$startPage"
    if ($simulation) { Write-Host 'Simulation only: in-memory devices and generated camera frames. No real MQTT connection or household database.' }
    else { Write-Host 'For a paired gateway, sign in using your domain account credentials.' }

    if (-not $NoBrowser) {
        foreach ($url in @("$homeUrl$startPage")) {
            if ($url) { try { Start-Process $url | Out-Null } catch { Write-Host "Open this address in your browser: $url" } }
        }
    }
    Write-Host "Startup logs: $logDirectory"
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    $exitStatus = 1
} finally {
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
exit $exitStatus

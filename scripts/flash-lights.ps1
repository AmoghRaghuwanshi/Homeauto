param([string]$Port, [string]$FQBN = 'esp32:esp32:esp32', [switch]$CompileOnly, [ValidateSet(115200,230400,460800,921600)][int]$UploadSpeed = 115200)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolTemp = Join-Path $projectRoot '.local\tools\arduino\tmp'
New-Item -ItemType Directory -Path $toolTemp -Force | Out-Null
$env:TEMP = $toolTemp
$env:TMP = $toolTemp
$cli = Join-Path $projectRoot '.local\tools\arduino\arduino-cli.exe'
if (-not (Test-Path -LiteralPath $cli)) { $cli = (Get-Command arduino-cli -ErrorAction Stop).Source }
$cliConfig = Join-Path $projectRoot '.local\tools\arduino\arduino-cli.yaml'
$common = @()
if (Test-Path -LiteralPath $cliConfig) { $common = @('--config-file', $cliConfig) }
$sketch = Join-Path $projectRoot 'firmware\light_controller'
if (-not (Test-Path -LiteralPath (Join-Path $sketch 'homeauto_config.h'))) { throw 'Run scripts/prepare-lights.ps1 to provision private hotspot and MQTT settings first.' }
if (-not $CompileOnly) {
    $inventory = (& $cli @common board list --format json) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Could not scan serial ports.' }
    $ports = @($inventory.detected_ports | ForEach-Object { $_.port.address })
    if (-not $Port) {
        if ($ports.Count -ne 1) { throw 'Connect only the light-controller ESP32 with a data cable, or pass -Port COMx explicitly.' }
        $Port = $ports[0]
    }
    if ($ports -notcontains $Port) { throw 'The selected ESP32 serial port is not connected.' }
}
$build = Join-Path $projectRoot '.local\firmware-build\lights'
New-Item -ItemType Directory -Path $build -Force | Out-Null
& icacls.exe $build /inheritance:r /grant:r "$($env:USERDOMAIN)\$($env:USERNAME):(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict private firmware build access.' }
& $cli @common compile --fqbn $FQBN --build-path $build $sketch
if ($LASTEXITCODE -ne 0) { throw 'Light-controller compilation failed; nothing was flashed.' }
if (-not $CompileOnly) {
    & $cli @common upload --fqbn $FQBN --port $Port --input-dir $build --upload-property "upload.speed=$UploadSpeed" $sketch
    if ($LASTEXITCODE -ne 0) { throw 'Light-controller upload failed. Check the data cable and boot mode.' }
    Write-Host "Light controller flashed on $Port. Door firmware was not uploaded."
}

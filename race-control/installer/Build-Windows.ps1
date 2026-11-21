param([string] $SigningThumbprint)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
$output = Join-Path $root 'artifacts'
$stage = Join-Path $output 'Windows'
New-Item -ItemType Directory -Force $stage | Out-Null
$appDir = Join-Path $stage 'app'
if (Test-Path $appDir) { Remove-Item $appDir -Recurse -Force }
dotnet publish (Join-Path $root 'desk/RaceControl.csproj') -c Release -r win-x64 --self-contained true -o $appDir
if ($LASTEXITCODE -ne 0) { throw 'Windows build failed.' }
Copy-Item (Join-Path $PSScriptRoot 'Install-SpeedTrap.ps1') $stage
if ($SigningThumbprint) {
    $certificate = Get-Item "Cert:\CurrentUser\My\$SigningThumbprint"
    Get-ChildItem $stage -Recurse -File | Where-Object { $_.Name -in @('RaceControl.exe','Install-SpeedTrap.ps1') } |
        ForEach-Object {
            $signature = Set-AuthenticodeSignature -FilePath $_.FullName -Certificate $certificate -TimestampServer 'http://timestamp.digicert.com'
            if ($signature.Status -ne 'Valid') { throw "Signature failed for $($_.Name)." }
        }
}
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath (Join-Path $output 'SpeedTrap-RaceControl-win-x64.zip') -Force

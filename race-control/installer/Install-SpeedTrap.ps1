param(
    [ValidateSet('Desk','Rig')][string] $Role,
    [string] $DeskUrl = 'http://127.0.0.1:5080',
    [string] $RigName,
    [string] $SteamApps,
    [string[]] $VerifiedPresets,
    [switch] $Cloud,
    [switch] $UsePrevious
)
$ErrorActionPreference = 'Stop'
if (-not $Role) { $Role = Read-Host 'Install Desk or Rig' }
if ($Role -notin @('Desk','Rig')) { throw 'Choose Desk or Rig.' }
$root = Join-Path $env:LOCALAPPDATA 'SpeedTrap'
$homeDir = Join-Path $root $Role
$release = Join-Path $homeDir 'app'
$prior = Join-Path $homeDir 'previous'
New-Item -ItemType Directory $homeDir -Force | Out-Null
$runningProcesses = Get-Process RaceControl -ErrorAction SilentlyContinue
if ($runningProcesses) { throw 'Close Race Control when the rigs are idle, then run this installer.' }
if ($UsePrevious) {
    if (-not (Test-Path (Join-Path $prior 'RaceControl.exe'))) { throw 'No previous version is installed.' }
    $temporary = Join-Path $homeDir ('swap-' + [guid]::NewGuid())
    if (Test-Path $release) { Move-Item $release $temporary }
    Move-Item $prior $release
    if (Test-Path $temporary) { Move-Item $temporary $prior }
} else {
    $source = Join-Path $PSScriptRoot 'app'
    if (-not (Test-Path (Join-Path $source 'RaceControl.exe'))) { throw 'Extract the complete Windows distribution first.' }
    $staged = Join-Path $homeDir ('staged-' + [guid]::NewGuid())
    Copy-Item $source $staged -Recurse
    if (Test-Path $prior) { Remove-Item $prior -Recurse -Force }
    if (Test-Path $release) { Move-Item $release $prior }
    try { Move-Item $staged $release }
    catch {
        if (Test-Path $prior) { Move-Item $prior $release }
        throw
    }
}
$shortcutArgs = ''
if ($Role -eq 'Rig') {
    $configFile = Join-Path $homeDir 'rig.json'
    if (-not (Test-Path $configFile)) {
        if (-not $RigName) { $RigName = Read-Host 'Rig name' }
        if (-not $PSBoundParameters.ContainsKey('DeskUrl')) { $DeskUrl = Read-Host 'Desk HTTPS URL' }
        if (-not $SteamApps) {
            $SteamApps = Read-Host 'Steam steamapps folder (leave blank to use the default)'
            if (-not $SteamApps) { $SteamApps = Join-Path ${env:ProgramFiles(x86)} 'Steam\steamapps' }
        }
        if (-not $VerifiedPresets) {
            Write-Host 'Confirm the installed games, controllers and content before enabling each preset.'
            Write-Host 'Options: rf2-practice, rf2-race, ac-hotlap, ac-traffic, iracing-hosted'
            $VerifiedPresets = @((Read-Host 'Verified presets, separated by commas').Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        }
        $code = Read-Host 'One-time code from the desk'
        @{ desk=$DeskUrl; name=$RigName; code=$code; verifiedPresets=@($VerifiedPresets); steamApps=$SteamApps; simulated=$false; cloud=[bool]$Cloud } |
            ConvertTo-Json | Set-Content $configFile -Encoding UTF8
        Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue |
            Where-Object { $_.Class -eq 'HIDClass' } | Select-Object FriendlyName,Status |
            ConvertTo-Json | Set-Content (Join-Path $homeDir 'controllers.json') -Encoding UTF8
    }
    $shortcutArgs = 'rig "' + $configFile + '"'
} else {
    $shortcutArgs = '--urls ' + $DeskUrl
    Write-Host 'Open the desk URL after starting the shortcut. The operator key file path is displayed in the window.'
}
$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut((Join-Path $desktop "Speed Trap $Role.lnk"))
$link.TargetPath = Join-Path $release 'RaceControl.exe'
$link.Arguments = $shortcutArgs
$link.WorkingDirectory = $release
$link.Save()
Write-Host "Installed Speed Trap $Role. Open its desktop shortcut."

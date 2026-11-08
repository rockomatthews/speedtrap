# Read-only venue inventory. Run locally in PowerShell; no administrator rights needed.
# Does not launch/stop software, read license keys, change settings or send data.
$ErrorActionPreference = 'Stop'
$inventoryErrors = @()
function Read-Inventory([scriptblock]$Query) {
  try { & $Query } catch { $script:inventoryErrors += $_.Exception.Message; @() }
}
$installed = @(Read-Inventory {
  foreach ($key in @('HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*','HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*')) {
    Get-ItemProperty $key -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName -match 'VMS|Venue Management|Assetto|iRacing|SimHub' } |
      Select-Object DisplayName, DisplayVersion, Publisher
  }
})
$video = @(Read-Inventory { Get-CimInstance Win32_VideoController | Select-Object Name, DriverVersion, CurrentHorizontalResolution, CurrentVerticalResolution })
$controllers = @(Read-Inventory { Get-PnpDevice -PresentOnly | Where-Object { $_.FriendlyName -match 'wheel|pedal|joystick|game controller|Fanatec|Simucube|MOZA|Thrustmaster|Logitech.*(G29|G920|G923)' } | Select-Object Status,Class,FriendlyName })
$processes = @(Read-Inventory { Get-Process | Where-Object { $_.ProcessName -match 'VMS|Assetto|acs$|iRacing|SimHub' } | Select-Object ProcessName,Responding })
[ordered]@{
  schemaVersion = 1
  capturedAtUtc = [DateTime]::UtcNow.ToString('o')
  mode = 'read-only'
  installedSoftware = $installed
  graphics = $video
  controllerCandidates = $controllers
  relevantProcesses = $processes
  errors = $inventoryErrors
  limitations = @('Names are heuristic; manually verify omitted hardware/software.','Process presence is not rig readiness.','No content, calibration, licensing, network or launch capability is established.','No computer name, serial number, credential or license key is collected.')
} | ConvertTo-Json -Depth 5

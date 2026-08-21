$ErrorActionPreference = 'SilentlyContinue'
# launched by the VBS a moment ago
Start-Sleep -Seconds 3
$procs = Get-Process TextVault
if ($procs) {
  Write-Output ('RUNNING: ' + ($procs | ForEach-Object { $_.Id }) -join ' ')
  Write-Output ('HasMainWindow: ' + [bool]($procs | Where-Object { $_.MainWindowTitle }))
  # confirm the parent is NOT a console host (launcher detached properly)
  $wmi = Get-CimInstance Win32_Process -Filter "Name='TextVault.exe'"
  foreach ($p in $wmi) {
    $parent = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $p.ParentProcessId) -ErrorAction SilentlyContinue
    Write-Output ('Parent: ' + $(if ($parent) { $parent.Name } else { '(exited — detached)' }))
  }
  Stop-Process -Name TextVault -Force
  Write-Output 'CLEANED UP'
} else {
  Write-Output 'NOT RUNNING'
}

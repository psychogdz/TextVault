$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\P1165\Downloads\test3'
# secrets scan of tracked content (simple patterns)
$patterns = @('gho_[A-Za-z0-9]{20,}', 'ghp_[A-Za-z0-9]{20,}', 'github_pat_[A-Za-z0-9_]{20,}')
$files = git ls-files
$hits = @()
foreach ($f in $files) {
  if ($f -match 'package-lock\.json') { continue }
  $content = Get-Content $f -Raw -ErrorAction SilentlyContinue
  if ($null -eq $content) { continue }
  foreach ($p in $patterns) {
    if ($content -match $p) { $hits += "$f matches $p" }
  }
  if ($content -match '(?i)password\s*=\s*"[^"]{4,}"') { $hits += "$f contains password assignment" }
}
if ($hits.Count) { $hits | ForEach-Object { Write-Output "SECRET-SUSPECT: $_" }; exit 1 }
Write-Output 'SECRETS_CHECK_CLEAN'

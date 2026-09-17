# SunTime Explorer launcher with GPS support:
#   - starts a local HTTP server (vite preview, http://localhost:4173)
#   - opens it with Chrome/Edge
#   - localhost is a secure context, so the geolocation button works
# NOTE: keep this file ASCII-only (see start-suntime.ps1).
$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot
if (-not (Test-Path (Join-Path $PSScriptRoot 'dist'))) {
  Write-Host 'dist\ not found, building...'
  npm run build
}

$browsers = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
)

Write-Host ''
Write-Host 'Starting local server at http://localhost:4173'
Write-Host 'Keep this window OPEN while using the app.'
Write-Host 'Closing this window stops the server.'
Write-Host ''
Start-Sleep -Seconds 1
$browser = $browsers | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if ($browser) {
  Start-Process -FilePath $browser -ArgumentList 'http://localhost:4173'
} else {
  Start-Process 'http://localhost:4173'
}
npx vite preview --port 4173 --strictPort

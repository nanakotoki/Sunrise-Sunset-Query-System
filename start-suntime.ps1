# SunTime Explorer launcher: open the single-file build with Chrome/Edge.
# (Avoids the default browser such as Quark taking over .html files.)
# NOTE: keep this file ASCII-only. Windows PowerShell parses non-BOM files
# as ANSI, and cmd parses .bat as GBK, so Chinese text breaks both.
$ErrorActionPreference = 'Stop'

$html = Join-Path $PSScriptRoot 'dist-single\index.html'
if (-not (Test-Path -LiteralPath $html)) {
  Write-Host 'dist-single\index.html not found, building...'
  Set-Location $PSScriptRoot
  npm run build:single
  if (-not (Test-Path -LiteralPath $html)) {
    Write-Host ''
    Write-Host 'Build failed. Please install Node.js, then run: npm install'
    exit 1
  }
}

$browsers = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
)

$browser = $browsers | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if ($browser) {
  $url = 'file:///' + ($html -replace '\\', '/')
  Start-Process -FilePath $browser -ArgumentList @('--app=' + $url)
  exit 0
}

Write-Host 'Chrome/Edge not found, opening with the default browser...'
Start-Process -FilePath $html

<#
SunTime Explorer 本地服务器启动器：
  - 启动一个轻量本地 HTTP 服务器（vite preview，localhost:4173）
  - 用 Chrome / Edge 打开 http://localhost:4173
  - localhost 属于浏览器安全上下文，GPS 定位按钮可用
用完直接关浏览器和这个窗口即可。
#>
$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot
if (-not (Test-Path (Join-Path $PSScriptRoot 'dist'))) {
  Write-Host "正在构建…"
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

Write-Host ""
Write-Host "启动本地服务器 http://localhost:4173 （关闭本窗口即停止）" -ForegroundColor Cyan
Start-Sleep -Seconds 1
$browser = $browsers | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($browser) {
  Start-Process $browser -ArgumentList 'http://localhost:4173'
} else {
  Start-Process 'http://localhost:4173'
}
npx vite preview --port 4173 --strictPort

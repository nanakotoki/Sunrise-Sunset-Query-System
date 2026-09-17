<# 
SunTime Explorer 启动器：用系统里的 Chrome / Edge 打开本地单文件版（避免被夸克等接管默认关联）。
启动后本窗口自动关闭。放在项目根目录双击即可。
#>
$ErrorActionPreference = 'SilentlyContinue'

$html = Join-Path $PSScriptRoot 'dist-single\index.html'
if (-not (Test-Path $html)) {
  # 没有构建产物就现构建（需要 node 环境）
  Write-Host "未找到 dist-single\index.html，正在构建…"
  Set-Location $PSScriptRoot
  npm run build:single
}

$browsers = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
)

$browser = $browsers | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($browser) {
  # --app 以独立窗口打开，不带浏览器 UI；new-window 普通标签页
  Start-Process $browser -ArgumentList @('--app=file://' + ($html -replace '\\', '/'))
  exit
}

# 没有任何 Chrome/Edge：退回默认处理器（仍可能是夸克）
Write-Host "未找到 Chrome / Edge，使用系统默认浏览器打开…"
Start-Process $html

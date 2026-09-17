@echo off
rem SunTime Explorer 启动器：调用 Chrome/Edge 打开，避免被夸克等接管
rem 双击运行即可。若 PowerShell 执行策略受限，用 -ExecutionPolicy Bypass 绕过。
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0启动SunTime.ps1"

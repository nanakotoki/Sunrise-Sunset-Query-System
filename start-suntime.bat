@echo off
rem SunTime Explorer launcher: opens the app with Chrome/Edge.
rem NOTE: keep this file ASCII-only. cmd.exe parses .bat files as ANSI/GBK,
rem so any non-ASCII character corrupts the commands below.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-suntime.ps1"
if errorlevel 1 pause

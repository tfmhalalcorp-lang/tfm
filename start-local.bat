@echo off
REM Double-click this file to run OrderCenter locally.
REM It starts a tiny local web server (no install needed) and opens your
REM browser to it automatically. Keep this window open while you use the
REM app; close it (or press Ctrl+C) when you're done.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\local-server.ps1"
pause

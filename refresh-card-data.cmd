@echo off
setlocal
cd /d "%~dp0"

set "CODEX_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%CODEX_PYTHON%" (
  "%CODEX_PYTHON%" scripts\fetch_fandom_metadata.py
  if not errorlevel 1 "%CODEX_PYTHON%" scripts\fetch_sekai_titles.py
) else (
  python scripts\fetch_fandom_metadata.py
  if not errorlevel 1 python scripts\fetch_sekai_titles.py
)

pause
endlocal

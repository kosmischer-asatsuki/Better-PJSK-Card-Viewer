@echo off
setlocal
cd /d "%~dp0"

set "CODEX_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
set "CODEX_PNPM=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"

if exist "%CODEX_PNPM%" (
  set "PATH=%CODEX_NODE%;%PATH%"
  call "%CODEX_PNPM%" run local
) else (
  where pnpm >nul 2>nul
  if not errorlevel 1 (
    call pnpm run local
  ) else (
    call npm run local
  )
)

endlocal

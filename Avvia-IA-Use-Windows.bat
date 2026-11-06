@echo off
cd /d "%~dp0"
title IA-Use - Multi-AI Desktop Workspace

echo ===================================================
echo   Avvio di IA-Use (Multi-AI Desktop Workspace)
echo ===================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [!] Node.js non e' installato sul tuo PC.
    echo Scaricalo gratis da: https://nodejs.org ^(bottone verde LTS^)
    echo Una volta installato Node.js, fai di nuovo doppio click su questo file!
    echo.
    start https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo.
    echo Prima installazione in corso ^(richiede circa 15-30 secondi^)...
    call npm install
)

echo.
echo Apertura di IA-Use in corso...
call npm start

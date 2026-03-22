@echo off
setlocal EnableDelayedExpansion

echo starting...

set "x1="

for /L %%a in (3,1,13) do (
    set "k=HKCU\Software\Adobe\CSXS.%%a"
    reg add "!k!" /f >nul 2>&1
    reg add "!k!" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
)

for /R "%~dp0" %%b in (manifest.xml) do (
    if not defined x1 (
        set "p=%%~dpb"
        if "!p:~-1!"=="\" set "p=!p:~0,-1!"
        echo !p! | findstr /I "\\CSXS" >nul
        if !errorlevel!==0 (
            echo !p! | findstr /I "Program Files" >nul
            if !errorlevel! neq 0 (
                for %%c in ("!p!\..") do set "x1=%%~fc"
            )
        )
    )
)

if not defined x1 (
    echo couldnt find extension
    pause
    exit /b 1
)

for %%d in ("!x1!") do set "n1=%%~nxd"

set "t1=%ProgramFiles%\Common Files\Adobe\CEP\extensions\%n1%"

echo copying...

if not exist "!t1!" mkdir "!t1!"
xcopy /E /Y /I "!x1!\*" "!t1!\" >nul

if %errorlevel% neq 0 (
    echo failed try admin
    pause
    exit /b 1
)

echo done
pause
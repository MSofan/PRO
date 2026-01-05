@echo off
echo ==========================================
echo Starting Employee System (Server Mode)
echo ==========================================
echo.
echo 1. Stopping any old servers...
taskkill /F /IM node.exe >nul 2>&1
echo.

echo 2. Installing dependencies (if needed)...
if not exist node_modules call npm install express googleapis cors
echo.

echo 3. Starting Server...
echo API running at: http://localhost:3000
echo App running at: http://localhost:3000
echo.
echo DO NOT CLOSE THIS WINDOW
echo.

start http://localhost:3000
node server.js
pause

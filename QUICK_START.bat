@echo off
rem Run from the folder this script lives in, wherever the project is.
cd /d "%~dp0"
echo Installing dependencies...
call npm install
if not exist .env (
  echo Creating .env from .env.example - set JWT_SECRET before going to production.
  copy .env.example .env
)
echo.
echo Starting PostgreSQL (Docker)...
call npm run db:up
echo.
echo Applying database migrations...
call npm run db:deploy
echo.
echo Starting development server...
echo (First run? In another terminal: npm run db:seed)
call npm run dev
pause

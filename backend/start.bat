@echo off
taskkill /F /IM python.exe /T 2>nul
timeout /t 1 /nobreak > nul
cd /d D:\AI编程\个人知识库RAG问答\backend
set PYTHONIOENCODING=utf-8
venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info

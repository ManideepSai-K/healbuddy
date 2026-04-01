# HealBuddy Backend (`ml_api`)

FastAPI service for predictions and Q&A.

## Setup

```powershell
cd ml_api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Run backend

```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 9014
```

Useful endpoints:
- `GET http://127.0.0.1:9014/health`
- `GET http://127.0.0.1:9014/debug`
- `POST http://127.0.0.1:9014/predict`
- `POST http://127.0.0.1:9014/ask`

## Local LLM (Ollama)

```powershell
$env:OLLAMA_BASE_URL="http://127.0.0.1:11434"
$env:OLLAMA_MODEL="llama3.2:3b"
python -m uvicorn main:app --host 127.0.0.1 --port 9014
```

## Notes

- `/ask` returns `source: "llm"` when model reply succeeds.
- If model is unavailable, `/ask` returns `source: "llm-error"` with a clear message.
- If LLM is not configured/available, knowledge-base fallback still works.

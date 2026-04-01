# HealBuddy

HealBuddy is split into:
- Frontend: `app/` (HTML/CSS/JS)
- Backend: `ml_api/` (FastAPI + ML + optional LLM)

## Quick start (single command)

From the project root:

```powershell
python run_dev.py
```

This starts:
- Frontend static server (`app/`) on an available port (`5500+`)
- Backend API (`ml_api/main.py`) on an available API port (`9014, 9013, 9012, 9000, ...`)

The script prints both URLs and a one-line `localStorage` command to bind frontend to the active backend port.

## Recommended local model mode (no billing)

1. Install Ollama: https://ollama.com/download
2. Pull/start a model:

```powershell
ollama run llama3.2:3b
```

3. Start HealBuddy:

```powershell
python run_dev.py
```

By default backend uses:
- `LLM_PROVIDER=ollama`
- `OLLAMA_BASE_URL=http://127.0.0.1:11434`
- `OLLAMA_MODEL=llama3.2:3b`

## Manual run (separate terminals)

Backend:

```powershell
cd ml_api
python -m uvicorn main:app --host 127.0.0.1 --port 9014
```

Frontend:

```powershell
cd app
python -m http.server 5500
```

Open:
- `http://127.0.0.1:5500/index.html`

# HealBuddy ML API

FastAPI service that provides machine-learning predictions for the HealBuddy symptom app.

## 1) Setup

```bash
cd ml_api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## 2) Run API

```bash
uvicorn main:app --reload --port 8000
```

Health check:
- `GET http://127.0.0.1:8000/health`

Prediction endpoint:
- `POST http://127.0.0.1:8000/predict`

## 3) Payload

```json
{
  "symptoms": ["Fever", "Body Pain", "Cough"],
  "age": 23,
  "durationDays": 2,
  "notes": "mild fatigue"
}
```

The API trains an in-memory classifier from `../app/data.json` on startup and returns top predictions with confidence scores.

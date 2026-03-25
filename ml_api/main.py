from __future__ import annotations

import json
import os
import random
from pathlib import Path
from typing import Any
from urllib import error, request

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestClassifier


APP_DIR = Path(__file__).resolve().parent.parent / "app"
DATA_FILE = APP_DIR / "data.json"
RANDOM_SEED = 42
LLM_API_KEY = os.getenv("LLM_API_KEY", "").strip()
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini").strip()
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
LLM_TIMEOUT_SECS = float(os.getenv("LLM_TIMEOUT_SECS", "12"))


class PredictRequest(BaseModel):
    symptoms: list[str] = Field(default_factory=list)
    age: int | None = None
    durationDays: int | None = None
    notes: str | None = ""


class Prediction(BaseModel):
    condition: str
    confidence: float


class PredictResponse(BaseModel):
    predictedCondition: str
    confidence: float
    topPredictions: list[Prediction]
    modelVersion: str
    noteSeverityScore: float
    estimatedSeverity: str
    overview: str | None = None
    durationExpected: str | None = None
    homeCare: list[str] | None = None
    doctorWhen: list[str] | None = None
    followUp: list[str] | None = None
    timeline: str | None = None


class AskRequest(BaseModel):
    question: str
    condition: str | None = None
    context: str | None = ""


class AskResponse(BaseModel):
    answer: str
    source: str


class ModelBundle:
    def __init__(self, symptom_vocab: list[str], label_names: list[str], model: RandomForestClassifier, meta: dict[str, Any], data: dict[str, Any] | None = None):
        self.symptom_vocab = symptom_vocab
        self.label_names = label_names
        self.model = model
        self.meta = meta
        self.data = data or {}

    def _vectorize(self, symptoms: list[str], age: int | None, duration_days: int | None) -> np.ndarray:
        normalized = set(symptoms)
        symptom_bits = [1.0 if name in normalized else 0.0 for name in self.symptom_vocab]

        age_value = float(age or 0)
        duration_value = float(duration_days or 0)

        is_age_low = 1.0 if age is not None and age <= 5 else 0.0
        is_age_high = 1.0 if age is not None and age >= 65 else 0.0
        prolonged = 1.0 if duration_days is not None and duration_days >= 3 else 0.0

        return np.array(symptom_bits + [age_value, duration_value, is_age_low, is_age_high, prolonged], dtype=np.float32)

    def predict(self, payload: PredictRequest) -> PredictResponse:
        if not payload.symptoms:
            return PredictResponse(
                predictedCondition="No Data",
                confidence=0.0,
                topPredictions=[],
                modelVersion=self.meta["modelVersion"],
                noteSeverityScore=0.0,
                estimatedSeverity="unknown",
            )

        features = self._vectorize(payload.symptoms, payload.age, payload.durationDays).reshape(1, -1)
        proba = self.model.predict_proba(features)[0]

        top_indices = np.argsort(proba)[::-1][:3]
        predictions = [
            Prediction(
                condition=self.label_names[index],
                confidence=round(float(proba[index]) * 100, 2),
            )
            for index in top_indices
        ]

        # AI severity inference from notes
        severity_score = self._infer_severity_from_notes(payload.notes or "")
        estimated_severity = self._map_severity_score(severity_score)

        top = predictions[0]
        
        # Fetch rich condition data from data.json
        condition_data = next(
            (c for c in self.data.get("conditions", []) if c["name"] == top.condition),
            {}
        )

        return PredictResponse(
            predictedCondition=top.condition,
            confidence=top.confidence,
            topPredictions=predictions,
            modelVersion=self.meta["modelVersion"],
            noteSeverityScore=round(severity_score, 2),
            estimatedSeverity=estimated_severity,
            overview=condition_data.get("overview", ""),
            durationExpected=condition_data.get("durationExpected", ""),
            homeCare=condition_data.get("homeCare", []),
            doctorWhen=condition_data.get("doctorWhen", []),
            followUp=condition_data.get("followUp", []),
            timeline=condition_data.get("timeline", ""),
        )

    def _infer_severity_from_notes(self, notes: str) -> float:
        """AI: Extract severity indicators from free text notes."""
        notes_lower = notes.lower()
        base_score = 0.0

        severity_keywords = {
            "severe": 0.3,
            "unbearable": 0.35,
            "intense": 0.25,
            "excruciating": 0.4,
            "mild": -0.2,
            "slight": -0.15,
            "managed": -0.1,
            "worse": 0.2,
            "worsening": 0.2,
            "improving": -0.15,
            "blood": 0.3,
            "unconscious": 0.4,
            "faint": 0.35,
            "urgent": 0.25,
            "persistent": 0.15,
            "sudden": 0.15,
            "sharp": 0.2,
            "throbbing": 0.15,
        }

        for keyword, weight in severity_keywords.items():
            if keyword in notes_lower:
                base_score += weight

        return max(-0.5, min(1.0, base_score))

    def _map_severity_score(self, score: float) -> str:
        """Map numeric severity to category."""
        if score >= 0.3:
            return "high"
        elif score >= 0.1:
            return "moderate"
        elif score >= -0.1:
            return "mild"
        else:
            return "minimal"



def load_data() -> dict[str, Any]:
    with DATA_FILE.open("r", encoding="utf-8") as data_file:
        return json.load(data_file)



def build_training_samples(data: dict[str, Any]) -> tuple[list[list[float]], list[int], list[str]]:
    conditions = data.get("conditions", [])
    symptom_vocab = sorted({symptom for condition in conditions for symptom in condition.get("symptoms", [])})

    label_names = [condition["name"] for condition in conditions]
    label_lookup = {name: idx for idx, name in enumerate(label_names)}

    random.seed(RANDOM_SEED)

    X: list[list[float]] = []
    y: list[int] = []

    for condition in conditions:
        target = label_lookup[condition["name"]]
        core_symptoms = condition.get("symptoms", [])

        for _ in range(70):
            active = set(core_symptoms)

            keep_count = random.randint(max(1, len(core_symptoms) - 2), len(core_symptoms))
            active = set(random.sample(list(active), keep_count))

            if random.random() < 0.35:
                noise = random.choice(symptom_vocab)
                active.add(noise)

            age = random.randint(7, 60)
            duration = random.randint(1, 4)

            if "Fever" in active and random.random() < 0.4:
                duration = random.randint(2, 6)

            symptom_bits = [1.0 if name in active else 0.0 for name in symptom_vocab]
            is_age_low = 1.0 if age <= 5 else 0.0
            is_age_high = 1.0 if age >= 65 else 0.0
            prolonged = 1.0 if duration >= 3 else 0.0

            row = symptom_bits + [float(age), float(duration), is_age_low, is_age_high, prolonged]
            X.append(row)
            y.append(target)

    return X, y, symptom_vocab



def train_model() -> ModelBundle:
    data = load_data()
    X, y, symptom_vocab = build_training_samples(data)

    conditions = data.get("conditions", [])
    label_names = [condition["name"] for condition in conditions]

    model = RandomForestClassifier(
        n_estimators=240,
        max_depth=8,
        random_state=RANDOM_SEED,
    )
    model.fit(X, y)

    return ModelBundle(
        symptom_vocab=symptom_vocab,
        label_names=label_names,
        model=model,
        meta={"modelVersion": "healbuddy-rf-v1"},
        data=data,
    )


model_bundle = train_model()

app = FastAPI(title="HealBuddy ML API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "modelVersion": model_bundle.meta["modelVersion"]}


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    return model_bundle.predict(payload)


@app.post("/ask", response_model=AskResponse)
def ask(payload: AskRequest) -> AskResponse:
    """Answer user questions using LLM when configured, with KB fallback."""
    question_lower = payload.question.lower()
    condition_name = payload.condition or ""
    data = load_data()
    
    # Find matching condition in database
    condition_data = next(
        (c for c in data.get("conditions", []) if c["name"].lower() == condition_name.lower()),
        {}
    )
    
    source = "knowledge-base"
    answer = _ask_with_llm(payload, condition_data)

    if answer:
        source = "llm"
    else:
        answer = _answer_question(question_lower, condition_data, data)

    return AskResponse(
        answer=answer,
        source=source
    )


def _ask_with_llm(payload: AskRequest, condition_data: dict[str, Any]) -> str | None:
    """Call an OpenAI-compatible chat completion API. Returns None on any failure."""
    if not LLM_API_KEY:
        return None

    condition_context = {
        "condition": condition_data.get("name", payload.condition or "Unknown"),
        "overview": condition_data.get("overview", ""),
        "durationExpected": condition_data.get("durationExpected", ""),
        "homeCare": condition_data.get("homeCare", []),
        "doctorWhen": condition_data.get("doctorWhen", []),
        "followUp": condition_data.get("followUp", []),
        "timeline": condition_data.get("timeline", ""),
    }

    system_prompt = (
        "You are HealBuddy, a cautious health guidance assistant. "
        "Use simple language, be brief, and only provide general educational guidance. "
        "Do not diagnose. If urgent red flags are possible, advise immediate in-person care. "
        "Always end with a short safety note that this is not medical diagnosis."
    )

    user_prompt = (
        f"User question: {payload.question.strip()}\n"
        f"Predicted context: {json.dumps(condition_context, ensure_ascii=False)}\n"
        f"User extra context: {(payload.context or '').strip()}"
    )

    body = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 260,
    }

    req = request.Request(
        url=f"{LLM_BASE_URL}/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {LLM_API_KEY}",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=LLM_TIMEOUT_SECS) as response:
            raw = response.read().decode("utf-8")
            parsed = json.loads(raw)
            content = (
                parsed.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            return content or None
    except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError, KeyError, IndexError, TypeError, ValueError):
        return None


def _answer_question(question: str, condition_data: dict, data: dict) -> str:
    """Generate answer based on knowledge base patterns."""
    q = question.lower()
    
    # Duration questions
    if any(word in q for word in ["how long", "duration", "recover", "weeks", "days", "how many days"]):
        if condition_data.get("durationExpected"):
            return f"This condition typically lasts {condition_data['durationExpected']}. For detailed timeline, see our 'What to expect' section."
        return "Most conditions resolve within 1-2 weeks with proper care. Consult a doctor if symptoms persist."
    
    # Treatment/medication questions
    if any(word in q for word in ["medicine", "medication", "treat", "drug", "pill", "tablet"]):
        home_care = condition_data.get("homeCare", [])
        if home_care:
            meds = [item for item in home_care if any(med in item.lower() for med in ["ibuprofen", "acetaminophen", "aspirin", "antihistamine"])]
            if meds:
                return f"Over-the-counter option: {meds[0]}. Always follow package directions and consult a pharmacist if unsure."
            return f"Home care includes: {home_care[0]}. See full 'What you can do at home' section for more."
        return "Rest, hydration, and OTC pain relievers often help. Ask a pharmacist for specific medication advice."
    
    # When to see doctor
    if any(word in q for word in ["doctor", "hospital", "urgent", "emergency", "911", "when should i"]):
        doctor_when = condition_data.get("doctorWhen", [])
        if doctor_when:
            return f"Seek medical care if: {doctor_when[0]}"
        return "If symptoms worsen, don't improve, or you develop serious signs, see a doctor."
    
    # Contagious
    if any(word in q for word in ["contagious", "spread", "others", "infect"]):
        overview = condition_data.get("overview", "").lower()
        if "viral" in overview:
            return "Viral infections often spread through droplets/contact. Wash hands, cover coughs, stay home if sick."
        if "bacterial" in overview:
            return "Bacterial infections can be contagious. Practice good hygiene and follow doctor guidance on isolation."
        return "Check if it's viral or bacterial for contagion info. Most improve within days with care."
    
    # Symptom relief
    if any(word in q for word in ["relief", "better", "improve", "feel", "help", "ease"]):
        home_care = condition_data.get("homeCare", [])
        if home_care and len(home_care) >= 2:
            return f"Try: {home_care[0]} and {home_care[1]}. Relief typically comes within hours."
        return "Rest, hydration, and keeping comfortable usually help. Most symptoms improve within 1-2 days."
    
    # Age/risk
    if any(word in q for word in ["age", "child", "elderly", "baby", "pregnant"]):
        return "Age matters for treatment. Young children and elderly need extra care. If high-risk, see your doctor sooner."
    
    # Default
    if condition_data.get("overview"):
        return f"Your condition: {condition_data['overview']} Ask me about treatment, when to see a doctor, or anything else from your results."
    
    return "I'm here to help. Ask me anything about treatment, symptoms, when to see a doctor, or your results."

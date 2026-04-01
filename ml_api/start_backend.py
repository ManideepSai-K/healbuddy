from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
from pathlib import Path
from urllib import request, error

PORT_CANDIDATES = [9018, 9017, 9016, 9015, 9014]


def resolve_python() -> str:
    env_python = os.getenv("BACKEND_PYTHON", "").strip()
    if env_python:
        return env_python

    py313 = Path("C:/Users/katur/AppData/Local/Programs/Python/Python313/python.exe")
    if py313.exists():
        return str(py313)

    return sys.executable


def is_port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return sock.connect_ex(("127.0.0.1", port)) != 0


def is_healbuddy_running(port: int) -> bool:
    try:
        with request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1.5) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return payload.get("status") == "ok" and "modelVersion" in payload
    except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError):
        return False


def pick_port() -> tuple[int, bool]:
    for port in PORT_CANDIDATES:
        if is_port_free(port):
            return port, False
        if is_healbuddy_running(port):
            return port, True

    for port in range(9020, 9060):
        if is_port_free(port):
            return port, False

    raise RuntimeError("No free port found for backend")


def main() -> int:
    python_bin = resolve_python()
    port, already_running = pick_port()

    if already_running:
        print(f"HealBuddy backend is already running on http://127.0.0.1:{port}")
        print("Tip: set localStorage apiBaseUrl to this port if needed.")
        return 0

    env = os.environ.copy()
    env.setdefault("LLM_PROVIDER", "ollama")
    env.setdefault("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    env.setdefault("OLLAMA_MODEL", "llama3.2:3b")
    env.setdefault("LLM_TIMEOUT_SECS", "120")

    print(f"Starting HealBuddy backend on http://127.0.0.1:{port}")
    print(f"Python: {python_bin}")

    return subprocess.call(
        [
            python_bin,
            "-m",
            "uvicorn",
            "main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        env=env,
    )


if __name__ == "__main__":
    raise SystemExit(main())

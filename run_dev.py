from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "ml_api"
FRONTEND_DIR = ROOT / "app"

BACKEND_PORT_CANDIDATES = [9018, 9017, 9016, 9015, 9014, 9013, 9012, 9000, 8001, 8000]
FRONTEND_PORT_CANDIDATES = [5500, 5501, 5502]


def _resolve_backend_python() -> str:
    env_python = os.getenv("BACKEND_PYTHON", "").strip()
    if env_python:
        return env_python

    py313 = Path("C:/Users/katur/AppData/Local/Programs/Python/Python313/python.exe")
    if py313.exists():
        return str(py313)

    return sys.executable


def _spawn(command: list[str], cwd: Path, env: dict[str, str] | None = None) -> subprocess.Popen:
    return subprocess.Popen(command, cwd=str(cwd), env=env)


def _is_port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return sock.connect_ex(("127.0.0.1", port)) != 0


def _pick_free_port(candidates: list[int]) -> int:
    for candidate in candidates:
        if _is_port_free(candidate):
            return candidate
    raise RuntimeError(f"No free port in candidates: {candidates}")


def main() -> int:
    backend_port = _pick_free_port(BACKEND_PORT_CANDIDATES)
    frontend_port = _pick_free_port(FRONTEND_PORT_CANDIDATES)
    backend_python = _resolve_backend_python()

    backend_env = os.environ.copy()
    backend_env.setdefault("LLM_PROVIDER", "ollama")
    backend_env.setdefault("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    backend_env.setdefault("OLLAMA_MODEL", "llama3.2:3b")
    backend_env.setdefault("LLM_TIMEOUT_SECS", "120")

    backend = _spawn(
        [
            backend_python,
            "-m",
            "uvicorn",
            "main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(backend_port),
        ],
        cwd=BACKEND_DIR,
        env=backend_env,
    )

    frontend = _spawn(
        [sys.executable, "-m", "http.server", str(frontend_port)],
        cwd=FRONTEND_DIR,
        env=os.environ.copy(),
    )

    print("HealBuddy is starting...")
    print(f"Backend Python: {backend_python}")
    print(f"Frontend: http://127.0.0.1:{frontend_port}/index.html")
    print(f"Backend : http://127.0.0.1:{backend_port}/health")
    print(f"Tip: in browser console run localStorage.setItem('apiBaseUrl','http://127.0.0.1:{backend_port}')")
    print("Press Ctrl+C to stop both servers.")

    try:
        while True:
            if backend.poll() is not None:
                print("Backend stopped unexpectedly.")
                return backend.returncode or 1
            if frontend.poll() is not None:
                print("Frontend stopped unexpectedly.")
                return frontend.returncode or 1
            time.sleep(0.6)
    except KeyboardInterrupt:
        pass
    finally:
        for proc in (frontend, backend):
            if proc.poll() is None:
                proc.terminate()
        time.sleep(0.5)
        for proc in (frontend, backend):
            if proc.poll() is None:
                proc.kill()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

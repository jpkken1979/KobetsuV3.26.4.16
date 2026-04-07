#!/usr/bin/env python3
"""
Security helpers compartidos para servidores HTTP/MCP remotos.
"""

from __future__ import annotations

from pathlib import Path
from urllib.parse import urlsplit

DEFAULT_CORS_ORIGINS = [
    "http://localhost",
    "http://127.0.0.1",
    "https://tauri.localhost",
    "http://tauri.localhost",
]
LOCALHOST_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
LOCALHOST_IPS = {"127.0.0.1", "::1", "localhost"}


def parse_cors_origins(raw: str | None, default: list[str] | None = None) -> list[str]:
    """Parsea la configuración de orígenes CORS desde una cadena CSV."""
    defaults = default if default is not None else DEFAULT_CORS_ORIGINS
    source = raw if raw is not None else ",".join(defaults)
    origins = [origin.strip() for origin in source.split(",") if origin.strip()]
    return origins or defaults.copy()


def is_origin_allowed(origin: str, allowed_origins: list[str]) -> bool:
    """Valida origen CORS, permitiendo host/scheme con puerto variable."""
    if not origin:
        return False

    # Validar scheme ANTES del wildcard — file://, data://, javascript: siempre rechazados
    try:
        parsed_origin = urlsplit(origin)
    except ValueError:
        return False

    if not parsed_origin.scheme or not parsed_origin.hostname:
        return False

    # Only allow http/https schemes — reject file://, data://, javascript:, etc.
    if parsed_origin.scheme not in ("http", "https"):
        return False

    if "*" in allowed_origins:
        return True
    if origin in allowed_origins:
        return True

    for allowed in allowed_origins:
        try:
            parsed_allowed = urlsplit(allowed)
        except ValueError:
            continue

        if not parsed_allowed.scheme or not parsed_allowed.hostname:
            continue

        if (
            parsed_allowed.port is None
            and parsed_allowed.scheme == parsed_origin.scheme
            and parsed_allowed.hostname == parsed_origin.hostname
        ):
            return True
    return False


def build_cors_policy(origins: list[str] | None) -> tuple[list[str], str | None]:
    """Construye allow_origins y allow_origin_regex para middlewares CORS."""
    if origins is None:
        cleaned = DEFAULT_CORS_ORIGINS.copy()
    else:
        cleaned = [origin.strip() for origin in origins if origin and origin.strip()]
        if not cleaned:
            cleaned = DEFAULT_CORS_ORIGINS.copy()

    if "*" in cleaned:
        return ["*"], None

    allow_localhost_regex = False
    for origin in cleaned:
        parsed = urlsplit(origin)
        try:
            port = parsed.port
        except ValueError:
            continue
        if (
            parsed.scheme in {"http", "https"}
            and parsed.hostname in {"localhost", "127.0.0.1"}
            and port is None
        ):
            allow_localhost_regex = True
            break

    return cleaned, (LOCALHOST_ORIGIN_REGEX if allow_localhost_regex else None)


def is_localhost_client(client_ip: str) -> bool:
    """Retorna True si la IP del cliente corresponde a localhost."""
    if not client_ip:
        return False
    if client_ip in LOCALHOST_IPS:
        return True
    return client_ip.startswith("::ffff:127.0.0.1")


def is_within_root(root: str | Path, candidate: str | Path) -> bool:
    """Verifica que 'candidate' esté dentro de 'root' (previene path traversal).

    Acepta tanto str como Path. Compatible con agents-server.py, skills-server.py
    y ecosystem-server.py que usan Path directamente.
    """
    try:
        Path(candidate).resolve().relative_to(Path(root).resolve())
        return True
    except (OSError, ValueError):
        return False


# Alias para compatibilidad con verificadores legacy que esperan is_within_project_root
is_within_project_root = is_within_root

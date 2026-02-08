from __future__ import annotations

from typing import Iterable

STUDENT_ALIASES = {"student2", "student3"}


def normalize_role_code(code: str | None) -> str:
    normalized = (code or "").lower()
    if normalized in STUDENT_ALIASES:
        return "student"
    return normalized


def normalize_role_set(roles: Iterable[str] | None) -> set[str]:
    if not roles:
        return set()
    return {normalize_role_code(role) for role in roles if role}


def is_student_role(code: str | None) -> bool:
    return normalize_role_code(code) == "student"

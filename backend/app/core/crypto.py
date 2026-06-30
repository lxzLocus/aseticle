"""Symmetric encryption helpers for storing user-provided secrets (BYO API keys).

Uses Fernet (AES-128-CBC + HMAC) keyed by ``settings.ENCRYPTION_KEY``.
"""
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

_fernet = Fernet(settings.ENCRYPTION_KEY.encode())


def encrypt(plaintext: str) -> str:
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    try:
        return _fernet.decrypt(token.encode()).decode()
    except InvalidToken:
        raise ValueError("Failed to decrypt stored secret (key mismatch?)")


"""Local filesystem storage service for SECU selfies."""

import logging
import mimetypes
from pathlib import Path, PurePosixPath

logger = logging.getLogger("secu.storage")

# backend/local_storage/
BACKEND_DIR = Path(__file__).resolve().parents[2]
STORAGE_DIR = BACKEND_DIR / "local_storage"

APP_NAME = "secu-ai"


def init_storage(force: bool = False):
    """Initialize the local storage directory."""
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("Local storage initialized at %s", STORAGE_DIR)
    return str(STORAGE_DIR)


def _resolve_path(path: str) -> Path:
    """Resolve a storage path safely inside STORAGE_DIR."""
    if not path or not isinstance(path, str):
        raise ValueError("Invalid storage path")

    normalized = path.replace("\\", "/")
    relative = PurePosixPath(normalized)

    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("Invalid storage path")

    target = (STORAGE_DIR / Path(*relative.parts)).resolve()

    try:
        target.relative_to(STORAGE_DIR.resolve())
    except ValueError:
        raise ValueError("Storage path is outside the storage directory")

    return target


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Save an object locally and return its storage path."""
    try:
        target = _resolve_path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

        return {
            "path": path.replace("\\", "/"),
            "content_type": content_type or "application/octet-stream",
        }
    except Exception as exc:
        logger.error("Local storage write failed: %s", type(exc).__name__)
        raise


def get_object(path: str):
    """Retrieve an object as (bytes, content_type)."""
    try:
        target = _resolve_path(path)

        if not target.is_file():
            raise FileNotFoundError(f"Stored file not found: {path}")

        content = target.read_bytes()
        content_type = mimetypes.guess_type(target.name)[0]

        return content, content_type or "application/octet-stream"

    except Exception as exc:
        logger.error("Local storage read failed: %s", type(exc).__name__)
        raise

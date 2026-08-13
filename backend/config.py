from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATABASE_URL = f"sqlite:///{(DATA_DIR / 'creator_manager.db').as_posix()}"
UPLOAD_DIR = DATA_DIR / "imports"


def ensure_data_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

class Config:
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "lms-production-secret-key-2026")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET", "lms-production-jwt-key-2026")
    
    # Handle Vercel serverless writable /tmp directory
    db_env = os.getenv("DATABASE_URL")
    if db_env:
        SQLALCHEMY_DATABASE_URI = db_env
    elif os.getenv("VERCEL"):
        SQLALCHEMY_DATABASE_URI = "sqlite:////tmp/library.db"
    else:
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{BASE_DIR / 'database' / 'library.db'}"

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "connect_args": {"timeout": 30}
    }

from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
INPUT_DIR = BASE_DIR / "input"
DATA_DIR = BASE_DIR / "data"

# Database
DATABASE_URL = f"sqlite:///{DATA_DIR / 'finance.db'}"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
INPUT_DIR.mkdir(exist_ok=True)

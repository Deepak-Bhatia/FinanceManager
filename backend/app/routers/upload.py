"""
Upload / ingestion router — parse folders.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.ingestion import get_available_folders, ingest_folder

router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.get("/folders")
def list_folders():
    """List available month folders in the input directory."""
    return get_available_folders()


@router.post("/parse/{folder_name}")
def parse_folder(folder_name: str, db: Session = Depends(get_db)):
    """Parse all files in a given folder and ingest transactions."""
    return ingest_folder(db, folder_name)

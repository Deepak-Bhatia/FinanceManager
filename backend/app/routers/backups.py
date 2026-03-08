from fastapi import APIRouter, HTTPException, Depends, Body
from typing import List
from pathlib import Path
import shutil
import datetime
import os
import sqlite3

from app.config import DATA_DIR
from app.database import init_db
from app.database import SessionLocal
import json
from app.models.audit_log import AuditLog

router = APIRouter(tags=["backup"], prefix="/api/backup")


def _db_path() -> Path:
    return Path(DATA_DIR) / 'finance.db'


def _backups_dir() -> Path:
    d = Path(DATA_DIR) / 'backups'
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.get("/list")
def list_backups():
    d = _backups_dir()
    files = sorted([f.name for f in d.iterdir() if f.is_file()], reverse=True)
    return files


@router.post("/create")
def create_backup():
    src = _db_path()
    if not src.exists():
        raise HTTPException(status_code=404, detail="Database file not found")
    dst = _backups_dir() / f"finance-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}.db"
    shutil.copy2(str(src), str(dst))
    # record audit
    try:
        db = SessionLocal()
        db.add(AuditLog(
            event_type="backup",
            summary=f"Created backup {dst.name}",
            details=json.dumps({"backup": dst.name, "path": str(dst)})
        ))
        db.commit()
    except Exception:
        pass
    return {"backup": dst.name}


@router.post("/restore/{name}")
def restore_backup(name: str):
    d = _backups_dir()
    src = d / name
    if not src.exists():
        raise HTTPException(status_code=404, detail="Backup not found")
    dst = _db_path()
    # Before restoring, always create a backup of current DB (if exists)
    pre_bname = None
    cur = _db_path()
    if cur.exists():
        try:
            pre_bname = f"finance-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}.db"
            pre_dst = _backups_dir() / pre_bname
            shutil.copy2(str(cur), str(pre_dst))
            try:
                db = SessionLocal()
                db.add(AuditLog(
                    event_type="backup",
                    summary=f"Pre-restore backup {pre_bname}",
                    details=json.dumps({"backup": pre_bname, "path": str(pre_dst)})
                ))
                db.commit()
            except Exception:
                pass
        except Exception:
            # if backup fails, proceed to attempt restore but log nothing
            pre_bname = None

    # Overwrite current DB with selected backup
    shutil.copy2(str(src), str(dst))
    # Reinitialize DB metadata if needed
    try:
        init_db()
    except Exception:
        pass
    # audit restore
    try:
        db = SessionLocal()
        db.add(AuditLog(
            event_type="restore",
            summary=f"Restored backup {name}",
            details=json.dumps({"restored": name, "pre_backup": pre_bname})
        ))
        db.commit()
    except Exception:
        pass
    return {"restored": name}


@router.post("/clean")
def clean_data(entities: List[str] = Body(default=None)):
    # entities: list of entity keys to delete (e.g. ['transactions','emi','audit_logs','categories'])
    # If not provided, default to ['transactions'] for safety
    if not entities:
        entities = ["transactions"]
    # normalize
    entities = [str(e).strip() for e in entities if e]
    # create backup first
    src = _db_path()
    if src.exists():
        bname = f"finance-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}.db"
        dst = _backups_dir() / bname
        shutil.copy2(str(src), str(dst))
        # audit backup
        try:
            db = SessionLocal()
            db.add(AuditLog(
                event_type="backup",
                summary=f"Created backup before clean {bname}",
                details=json.dumps({"backup": bname, "path": str(dst)})
            ))
            db.commit()
        except Exception:
            pass
    # Truncate tables to clean data (safer on Windows when DB file is locked)
    if src.exists():
        try:
            conn = sqlite3.connect(str(src))
            cur = conn.cursor()
            # map allowed entity keys to actual table names (explicit whitelist)
            allowed = {
                'transactions': 'transactions',
                'emi': 'emi_details',
                'emi_details': 'emi_details',
                'audit': 'audit_logs',
                'audit_logs': 'audit_logs',
                'categories': 'categories',
                'category': 'categories'
            }
            tables = []
            for e in entities:
                k = e.lower()
                if k in allowed and allowed[k] not in tables:
                    tables.append(allowed[k])
            # Defensive: if no recognized tables, abort
            if len(tables) == 0:
                raise HTTPException(status_code=400, detail="No valid entity types provided for cleaning")
            # Audit the requested clean BEFORE performing deletes
            try:
                db = SessionLocal()
                db.add(AuditLog(
                    event_type="clean_requested",
                    summary=f"Requested clean for entities: {entities}",
                    details=json.dumps({"entities_requested": entities, "tables_to_delete": tables})
                ))
                db.commit()
            except Exception:
                pass
            deleted = []
            for t in tables:
                try:
                    # Only allow simple table names from the whitelist
                    cur.execute(f"DELETE FROM {t};")
                    deleted.append(t)
                except Exception:
                    pass
            conn.commit()
            conn.close()
            # audit clean
            try:
                db = SessionLocal()
                db.add(AuditLog(
                    event_type="clean",
                    summary=f"Cleaned database, backed up {bname}",
                    details=json.dumps({"backed_up": bname, "deleted_tables": deleted, "entities_requested": entities})
                ))
                db.commit()
            except Exception:
                pass
            return {"backed_up": bname, "status": "cleaned", "deleted_tables": deleted}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"status": "no_db"}

"""
FastAPI main application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, SessionLocal
from app.models.category import Category, DEFAULT_CATEGORIES
from app.services.categorizer import seed_rules

from app.routers import upload, transactions, dashboard, categories, creditcards, emis, cards, audit, backups, accounts, tags

app = FastAPI(title="PersonalFinance Manager", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(transactions.router)
app.include_router(dashboard.router)
app.include_router(categories.router)
app.include_router(creditcards.router)
app.include_router(emis.router)
app.include_router(cards.router)
app.include_router(audit.router)
app.include_router(backups.router)
app.include_router(accounts.router)
app.include_router(tags.router)


@app.on_event("startup")
def on_startup():
    init_db()
    _seed_categories()


def _seed_categories():
    db = SessionLocal()
    try:
        if db.query(Category).count() == 0:
            for cat in DEFAULT_CATEGORIES:
                db.add(Category(name=cat["name"], color=cat["color"], icon=cat.get("icon")))
            db.commit()
        seed_rules(db)
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok"}

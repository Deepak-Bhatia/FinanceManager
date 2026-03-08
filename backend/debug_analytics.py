from app.database import SessionLocal
from app.services.credit_card_service import get_analytics
import traceback

def main():
    db = SessionLocal()
    try:
        res = get_analytics(db, '2026-01')
        import json
        print(json.dumps(res, indent=2, default=str))
    except Exception as e:
        print('EXCEPTION:')
        traceback.print_exc()

if __name__ == '__main__':
    main()

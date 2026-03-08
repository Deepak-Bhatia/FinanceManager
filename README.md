# PersonalFinance Manager

A web-based personal finance management application that ingests monthly financial documents (bank statements, credit card reports, expense receipts), parses and normalizes them into a unified database, and presents interactive dashboards with charts for meaningful financial insights.

## Features

### MVP (Phase 1)
- Ingest monthly folders containing bank Excel/CSV files
- Parse and normalize transactions into a unified schema
- Store data in SQLite database
- Web dashboard with core charts:
  - Monthly spend summary (bar chart by category)
  - Category breakdown (pie/donut chart)
  - Expense trend over months (line chart)
  - Income vs Expense (stacked bar)

### Phase 2
- Credit card PDF statement parsing (text-based)
- Transaction categorization with keyword rules
- Monthly comparison views
- Top merchants/payees chart
- Budget vs Actual tracking

### Phase 3
- Manual expense entry via web UI
- Recurring expense detection
- Savings rate tracking
- Export reports (PDF/Excel)

### Phase 4
- Cloud deployment
- Multi-account aggregation
- Advanced analytics and forecasting

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI (Python 3.11+) |
| Database | SQLite (PostgreSQL-ready) |
| Frontend | React 18 + Vite |
| Charts | Recharts |
| Styling | Tailwind CSS |
| File Parsing | pandas, openpyxl, pdfplumber |
| HTTP Client | Axios |

## Project Structure

```
FinanceManager/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app entry point
│   │   ├── config.py               # App configuration
│   │   ├── database.py             # SQLite connection & ORM setup
│   │   ├── models/
│   │   │   ├── transaction.py      # Transaction model
│   │   │   ├── category.py         # Category model
│   │   │   └── account.py          # Account model
│   │   ├── parsers/
│   │   │   ├── base.py             # Base parser interface
│   │   │   ├── excel_parser.py     # Bank Excel/CSV parser
│   │   │   └── pdf_parser.py       # Credit card PDF parser
│   │   ├── routers/
│   │   │   ├── transactions.py     # Transaction CRUD endpoints
│   │   │   ├── upload.py           # File upload & ingestion endpoints
│   │   │   ├── dashboard.py        # Aggregated data for charts
│   │   │   └── categories.py       # Category management
│   │   └── services/
│   │       ├── ingestion.py        # Orchestrates folder/file parsing
│   │       ├── categorizer.py      # Rule-based categorization
│   │       └── aggregator.py       # Data aggregation for dashboards
│   ├── requirements.txt
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── components/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── charts/
│   │   │   │   ├── SpendByCategory.jsx
│   │   │   │   ├── MonthlyTrend.jsx
│   │   │   │   ├── IncomeVsExpense.jsx
│   │   │   │   └── TopMerchants.jsx
│   │   │   ├── TransactionTable.jsx
│   │   │   └── FileUpload.jsx
│   │   ├── services/
│   │   │   └── api.js              # Axios API client
│   │   └── styles/
│   ├── package.json
│   └── vite.config.js
├── input/                          # Monthly folders go here
│   └── 2026-01/
│       ├── bank_hdfc.xlsx
│       └── credit_card_icici.pdf
├── data/
│   └── finance.db                  # SQLite database file
├── README.md
└── PSD.md
```

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm or yarn

### Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev                  # Starts at http://localhost:5173
```

### Usage
1. Place monthly folders in the `input/` directory following the naming convention `YYYY-MM/`
2. Use the web UI to trigger ingestion or upload files directly
3. View dashboards at `http://localhost:5173`

## Input Folder Convention

```
input/
├── 2026-01/                    # January 2026
│   ├── bank_hdfc.xlsx
│   ├── bank_sbi.csv
│   └── credit_card_icici.pdf
├── 2026-02/                    # February 2026
│   └── ...
```

## Currency
Single currency: INR (₹)

## License
Private — Personal Use

# Project Specification Document — PersonalFinance Manager

**Version:** 1.0
**Date:** March 7, 2026
**Status:** Planning

---

## 1. Overview

PersonalFinance Manager is a locally-hosted web application for tracking and visualizing personal finances. The system ingests monthly financial documents from multiple sources (bank statements, credit card reports), parses them into a normalized transaction database, and renders interactive dashboards.

---

## 2. Goals

| # | Goal |
|---|---|
| G1 | Eliminate manual tracking — automate data extraction from bank/card documents |
| G2 | Unified view — single dashboard across all accounts |
| G3 | Trend visibility — understand spending patterns over time |
| G4 | Category insights — know where money goes each month |
| G5 | Local-first — all data stays on the user's machine |

---

## 3. Users

Single user (personal use). No authentication required for MVP. Authentication will be added before cloud deployment.

---

## 4. Data Sources & Parsing

### 4.1 Bank Transaction Sheets
- **Format:** `.xlsx` or `.csv`
- **Parser:** pandas + openpyxl
- **Approach:** Column mapping will be configured per bank after reviewing sample files. Each bank gets a parser profile defining which columns map to date, description, debit, credit, and balance.
- **Sample-driven:** Parser logic will be written after examining actual sample files.

### 4.2 Credit Card Statements
- **Format:** PDF (text-selectable, not scanned)
- **Parser:** pdfplumber (table extraction from structured PDFs)
- **Approach:** Extract transaction tables from PDF pages. Map columns to the transaction schema.

### 4.3 Future: Manual Entries
- Entered via web UI form
- Stored with `source = "manual"`

---

## 5. Data Model

### 5.1 Transaction (Core Entity)

| Field | Type | Description |
|---|---|---|
| id | INTEGER (PK) | Auto-increment |
| date | DATE | Transaction date |
| description | TEXT | Raw description from source |
| amount | DECIMAL(12,2) | Transaction amount (positive = debit/expense, negative = credit/income) |
| type | TEXT | `debit` or `credit` |
| category_id | INTEGER (FK) | Link to category |
| account_id | INTEGER (FK) | Link to account |
| source | TEXT | `bank_excel`, `credit_card_pdf`, `manual` |
| source_file | TEXT | Original filename |
| month | INTEGER | Extracted month (1-12) |
| year | INTEGER | Extracted year |
| is_recurring | BOOLEAN | Flag for recurring expenses |
| tags | TEXT | Comma-separated tags (optional) |
| notes | TEXT | User notes (optional) |
| created_at | DATETIME | Record creation timestamp |

### 5.2 Category

| Field | Type | Description |
|---|---|---|
| id | INTEGER (PK) | Auto-increment |
| name | TEXT | e.g., Food, Transport, Utilities |
| color | TEXT | Hex color for charts |
| icon | TEXT | Icon identifier (optional) |

**Default Categories:** Food & Dining, Groceries, Transport, Utilities, Rent, Entertainment, Shopping, Health, Education, Subscriptions, Transfer, ATM Withdrawal, Other

### 5.3 Account

| Field | Type | Description |
|---|---|---|
| id | INTEGER (PK) | Auto-increment |
| name | TEXT | e.g., "HDFC Savings", "ICICI Credit Card" |
| type | TEXT | `savings`, `current`, `credit_card` |
| bank | TEXT | Bank name |

### 5.4 Categorization Rule

| Field | Type | Description |
|---|---|---|
| id | INTEGER (PK) | Auto-increment |
| keyword | TEXT | Keyword to match in description |
| category_id | INTEGER (FK) | Category to assign |
| priority | INTEGER | Higher = checked first |

---

## 6. API Endpoints

### 6.1 Ingestion
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/upload` | Upload individual files |
| POST | `/api/ingest` | Trigger parsing of `input/` folder |
| GET | `/api/ingest/status` | Get last ingestion status |

### 6.2 Transactions
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/transactions` | List transactions (paginated, filterable) |
| GET | `/api/transactions/:id` | Get single transaction |
| PATCH | `/api/transactions/:id` | Update category/tags/notes |
| DELETE | `/api/transactions/:id` | Delete a transaction |

### 6.3 Dashboard / Aggregations
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard/summary?month=&year=` | Total income, expense, savings for a month |
| GET | `/api/dashboard/by-category?month=&year=` | Spending grouped by category |
| GET | `/api/dashboard/monthly-trend?year=` | Month-over-month totals |
| GET | `/api/dashboard/top-merchants?month=&year=&limit=` | Top N payees by amount |
| GET | `/api/dashboard/income-vs-expense?year=` | Monthly income vs expense |

### 6.4 Categories
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/categories` | List all categories |
| POST | `/api/categories` | Create a category |
| PUT | `/api/categories/:id` | Update a category |

### 6.5 Rules
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/rules` | List categorization rules |
| POST | `/api/rules` | Create a rule |
| DELETE | `/api/rules/:id` | Delete a rule |
| POST | `/api/rules/apply` | Re-apply all rules to uncategorized transactions |

---

## 7. Frontend Pages

### 7.1 Dashboard (Home)
- **Monthly Summary Cards:** Total Income, Total Expense, Net Savings, Transaction Count
- **Spend by Category:** Donut/pie chart
- **Monthly Trend:** Line chart (last 6-12 months)
- **Income vs Expense:** Stacked bar chart
- **Top 10 Merchants:** Horizontal bar chart
- Month/year selector to navigate

### 7.2 Transactions
- Paginated table with all transactions
- Filters: date range, category, account, type (debit/credit), search text
- Inline edit for category, tags, notes
- Bulk categorization

### 7.3 Upload / Ingest
- Drag-and-drop file upload
- Button to trigger folder ingestion
- Ingestion log/status display
- File history (previously ingested files — prevents duplicates)

### 7.4 Settings
- Manage categories (add/edit/delete, assign colors)
- Manage categorization rules
- Manage accounts
- Export data (CSV/Excel)

---

## 8. Categorization Logic

```
For each transaction:
  1. Check categorization rules (ordered by priority)
     - If description CONTAINS keyword → assign category
  2. If no rule matches → assign "Other" (uncategorized)
  3. User can manually override via UI
  4. Manual overrides can generate new rules (optional prompt)
```

---

## 9. Duplicate Detection

When ingesting files, prevent duplicates by:
1. Track `source_file` name — skip if file was already ingested
2. For same-file re-ingestion: match on `(date, description, amount, account)` tuple
3. User confirmation on potential duplicates

---

## 10. Non-Functional Requirements

| Requirement | Detail |
|---|---|
| **Currency** | INR (₹) only |
| **Performance** | Handle 10,000+ transactions without lag |
| **Storage** | SQLite (single file in `data/finance.db`) |
| **Deployment** | Local (localhost) for now; containerize with Docker for future cloud deployment |
| **Browser Support** | Modern browsers (Chrome, Edge, Firefox) |
| **Data Backup** | SQLite file can be copied/backed up manually |

---

## 11. Phased Delivery

### Phase 1 — MVP
- [ ] Project scaffolding (FastAPI + React + Vite)
- [ ] SQLite database setup with models
- [ ] Excel/CSV parser (bank transactions)
- [ ] Ingestion pipeline (folder-based)
- [ ] Transaction list API + UI table
- [ ] Dashboard with 4 core charts
- [ ] Basic categorization rules

### Phase 2 — Credit Cards & Categorization
- [ ] PDF credit card statement parser
- [ ] Enhanced categorization rule engine
- [ ] Monthly comparison view
- [ ] Budget setting and tracking
- [ ] Top merchants chart

### Phase 3 — Manual Entry & Advanced Features
- [ ] Manual transaction entry form
- [ ] Recurring expense detection
- [ ] Savings rate chart
- [ ] Report export (PDF/Excel)
- [ ] Duplicate detection improvements

### Phase 4 — Production Ready
- [ ] Docker containerization
- [ ] Authentication (single user login)
- [ ] Cloud deployment (Azure/AWS)
- [ ] Data backup/restore via UI
- [ ] Multi-account aggregated views

---

## 12. Technical Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Backend framework | FastAPI | Async, fast, auto-docs with Swagger |
| Database | SQLite | Zero config, portable, sufficient for single-user |
| Frontend | React + Vite | Modern DX, fast builds, rich ecosystem |
| Charts | Recharts | React-native, declarative, good defaults |
| CSS | Tailwind CSS | Utility-first, fast dashboard styling |
| PDF parsing | pdfplumber | Best for text-selectable PDFs with tables |
| Excel parsing | pandas + openpyxl | Industry standard, handles .xlsx and .csv |

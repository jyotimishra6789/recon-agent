# Reconciliation Agent Project Summary

## 1. Project overview
This project is a finance reconciliation dashboard that matches bank, settlement, and ledger records, flags exceptions, and supports AI-assisted Q&A and cash forecasting.

## 2. Core architecture

### Backend
- Framework: FastAPI
- Main app: `backend/main.py`
- Matching engine: `backend/matching_engine.py`
- Database schema: `backend/schema.sql`
- Data loader: `backend/load_data.py`

### Frontend
- Framework: React
- Main app: `frontend/src/App.jsx`
- API layer: `frontend/src/api.js`
- Styling: `frontend/src/index.css`

## 3. Matching logic
The system matches 3 main record types:

1. Bank transaction (`bank_txns`)
2. Settlement record (`settlement_txns`)
3. Ledger invoice (`ledger_txns`)

The pipeline works like this:
- Tier 1 deterministic matching by amount and date window
- Split/batch settlement matching for grouped payments
- Tier 2 Gemini-assisted fuzzy matching for unresolved records
- Unmatched entries become exceptions

### Matching rules used
- Exact / near-exact tolerance: ₹0.01
- Date drift window: 3 days
- Split match tolerance: ₹0.02
- Split match date window: 5 days

## 4. Exception handling
Anything still unmatched is inserted into the `exceptions` table with reasons such as:
- `missing_counterpart`

This is done in the final exception sweep in `matching_engine.py`.

## 5. Cash forecast
The cash forecast calculation is:

Projected balance = current cash + expected settlements - upcoming expenses

The backend endpoint is in `backend/main.py` under `/stats/cash-forecast`.

Default values are derived from:
- `bank_txns` for current cash
- `settlement_txns` for expected settlements
- `receipt_memory` for upcoming expenses

## 6. Receipt memory
`receipt_memory` is a table that stores uploaded receipts and classified expenses.

It is used to:
- queue receipts for reconciliation
- classify whether an upload is an expense
- add expense items into the ledger for later reconciliation
- feed cash forecast defaults

## 7. Assistant chat behavior
The assistant UI is a floating chat popover that exposes Q&A over the reconciliation dataset.

We also adjusted the UI so the chat content scrolls inside the assistant panel rather than scrolling the whole webpage.

## 8. Project status
The frontend and backend were both verified to build successfully:
- Frontend build: successful via `npm run build`
- Regression tests for the dashboard and auto-calc forecast: passed

## 9. How to run the project
### Backend
From repo root:

```powershell
cd backend
py -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend
From repo root:

```powershell
cd frontend
npm install
npm run start
```

Then open:
- http://localhost:3000

## 10. Key files
- `backend/main.py`
- `backend/matching_engine.py`
- `backend/schema.sql`
- `frontend/src/App.jsx`
- `frontend/src/components/CashForecast.jsx`
- `frontend/src/components/ChatbotQA.jsx`
- `frontend/src/index.css`

## 11. Conclusion
This project is a reconciliation dashboard with automated matching, AI-assisted exception handling, SQL-based analytics, receipt ingestion, and cash forecasting. It combines deterministic rules with Gemini-based fuzzy matching to create an explainable reconciliation workflow.

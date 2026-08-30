# Tax Line Matcher - Quick Start Guide

## ⚡ 5-Minute Setup

### Prerequisites
- Node.js (for frontend)
- Python 3.8+ (for backend)
- Your tax data in CSV format

### Step 1: Prepare Your Tax Data

Create `backend/tax.csv` with your tax records:

```csv
tax_id,invoice_id,tax_date,tax_type,tax_rate,base_amount,tax_amount,description
TAX_001,INV001,2024-01-15,GST,18.0,10000.00,1800.00,GST on services
TAX_002,INV002,2024-01-16,VAT,5.0,5000.00,250.00,VAT on supplies
TAX_003,INV003,2024-01-17,Income_Tax,10.0,8000.00,800.00,TDS withholding
```

**Field Descriptions:**
- `tax_id`: Unique identifier (e.g., TAX_001, GST_JAN_001)
- `invoice_id`: Must match an invoice in your ledger
- `tax_date`: Date in YYYY-MM-DD format
- `tax_type`: GST, VAT, Income_Tax, or Other
- `tax_rate`: Tax percentage (e.g., 18.0 for 18% GST)
- `base_amount`: Amount before tax
- `tax_amount`: Tax amount (will be verified)
- `description`: Optional notes

### Step 2: Start the Backend

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

You should see: `Uvicorn running on http://0.0.0.0:8000`

### Step 3: Start the Frontend

```bash
cd frontend
npm install  # First time only
npm start
```

Open http://localhost:3000 in your browser

### Step 4: Run Reconciliation

1. Click "Run reconciliation" button
2. Wait for the pipeline to complete
3. Click on "Tax Matches" tab

## 📊 What You'll See

### Tax Summary Cards
- **Total Tax Records**: Number of tax entries loaded
- **Matched Records**: Records successfully reconciled
- **Match Rate**: Percentage of records matched
- **Total Tax Amount**: Sum of all matched taxes

### Tax Breakdown Table
Shows distribution by tax type:
- Count of records per type
- Total amount for each type

### Tax Matches Table
Detailed view with:
- Tax ID, Type, Rate
- Base amount & Calculated tax
- Confidence score (color-coded)
- Match reasoning

## 🎯 Confidence Scoring Guide

| Score | Meaning | Color |
|-------|---------|-------|
| 95-100% | Exact match, no issues | 🟢 Green |
| 80-94% | Minor issues (date drift, rounding) | 🟡 Yellow |
| <80% | Significant discrepancies | 🔴 Red |

## 🔍 Example Confidence Calculations

### Example 1: Perfect Match ✅
```
Base Amount: ₹1,000
Tax Rate: 18%
Expected Tax: ₹180
Actual Tax: ₹180
Date Match: Same day

Confidence: 100%
```

### Example 2: Date Drift ⚠️
```
Same as above, but:
Date Drift: 2 days

Confidence: 90% (100% - 5% - 5%)
```

### Example 3: Calculation Error 🚨
```
Base Amount: ₹1,000
Tax Rate: 18%
Expected Tax: ₹180
Actual Tax: ₹185 (₹5 discrepancy)

Confidence: 70% (100% - 5% - 5% - 20%)
```

## 🚀 Advanced Usage

### View Tax Data via API

```bash
# Get all tax matches
curl http://localhost:8000/tax-matches

# Get tax summary
curl http://localhost:8000/tax-summary
```

### Check Audit Trail

All tax matching decisions are logged:
```bash
curl http://localhost:8000/audit-log | grep tier1_tax
```

### Reconciliation Results

After running reconciliation:
```bash
curl http://localhost:8000/stats/summary
```

Look for `tax_matches` in the response.

## 🐛 Troubleshooting

### Problem: "tax.csv not found"
- ✅ Create the file in `backend/` folder
- ✅ Verify exact filename: `tax.csv` (lowercase)
- ✅ Check CSV format matches the spec above

### Problem: No tax matches showing
- ✅ Verify `invoice_id` in tax.csv matches your ledger invoices
- ✅ Run `/reconcile` endpoint after loading data
- ✅ Check `match_tier = 'tier1_tax'` in audit log

### Problem: Low confidence scores
- ✅ Check tax calculation: `base_amount × tax_rate / 100`
- ✅ Verify date alignment (within 3-day window recommended)
- ✅ Look for rounding errors (should be ≤ ₹0.01)

### Problem: Backend won't start
- ✅ Ensure port 8000 is available
- ✅ Check Python version: `python --version` (3.8+)
- ✅ Install dependencies: `pip install -r requirements.txt`

### Problem: Frontend shows "failed to fetch"
- ✅ Verify backend is running: `curl http://localhost:8000/health`
- ✅ Check CORS is enabled in main.py
- ✅ Inspect browser console (F12) for error details

## 📈 Common Use Cases

### Use Case 1: GST Reconciliation
Perfect for Indian businesses reconciling GST records:
- Match GST amounts from invoices
- Verify GST calculations
- Track GST input/output

### Use Case 2: Multi-Currency Tax
Handle VAT in multiple jurisdictions:
- European VAT
- UK VAT
- Regional taxes

### Use Case 3: TDS Tracking
Monitor Tax Deducted at Source (TDS) payments:
- Track TDS amounts withheld
- Verify TDS calculations
- Match with ledger entries

### Use Case 4: Tax Audit Prep
Prepare tax records for audits:
- Get confidence scores
- Identify discrepancies early
- Generate audit trail

## 🎓 Next Steps

1. **Load Real Data**: Replace sample tax.csv with your actual tax records
2. **Review Exceptions**: Check low-confidence matches in detail
3. **Monitor Trends**: Track tax reconciliation over time
4. **Set Policies**: Define confidence thresholds for approval
5. **Automate**: Integrate with your finance workflow

## 📚 Learn More

- Full documentation: `TAX_MATCHER_GUIDE.md`
- API reference: `/health` endpoint lists all available APIs
- Audit trail: Shows all matching decisions and reasoning

## 💡 Pro Tips

1. **Import Incrementally**: Add tax records in batches to catch issues early
2. **Review Edge Cases**: Focus on low-confidence matches first
3. **Use Descriptions**: Add helpful notes in the description field
4. **Check Audit Log**: Every decision is logged for compliance
5. **Automate Exports**: Use API endpoints in scripts for daily reconciliation

## 🆘 Need Help?

1. Check the audit log for decision reasoning
2. Review the tax calculation verification in audit details
3. Verify your CSV format against the schema
4. Check the comprehensive guide: `TAX_MATCHER_GUIDE.md`

---

**Ready?** Start with Step 1 above! 🚀

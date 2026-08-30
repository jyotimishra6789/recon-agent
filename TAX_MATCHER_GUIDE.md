# Tax Line Matcher Implementation

## Overview
The Tax Line Matcher is a new feature in the Reconciliation Agent that automatically matches and reconciles tax records (GST, VAT, Income Tax, etc.) across invoices and bank transactions.

## Features

### 1. **Tax Data Management**
- **New Table**: `tax_txns` stores tax records with the following fields:
  - `tax_id`: Unique identifier for each tax record
  - `invoice_id`: Reference to the associated ledger invoice
  - `tax_date`: Date of the tax entry
  - `tax_type`: Type of tax (GST, VAT, Income_Tax, Other)
  - `tax_rate`: Tax rate as a percentage (e.g., 18.0 for 18% GST)
  - `base_amount`: Amount on which tax is calculated
  - `tax_amount`: Calculated tax amount
  - `description`: Additional notes about the tax

### 2. **Data Loading**
- Tax data is loaded from `backend/tax.csv` file if it exists
- The loader automatically processes the CSV and inserts records into the database
- Falls back gracefully if tax.csv is not found (optional feature)

### 3. **Tax Matching Engine (Tier 1 - Tax)**
The matching engine runs as part of the reconciliation pipeline with the following logic:

#### Matching Process
1. **Invoice Association**: Each tax record is matched to its corresponding ledger invoice by `invoice_id`
2. **Tax Calculation Verification**: 
   - Verifies that `tax_amount = base_amount × tax_rate / 100`
   - Tolerance: ±₹0.01 for rounding differences
3. **Confidence Scoring**:
   - Base confidence: 100%
   - Date drift penalty: -5% per day (max 3-day window acceptable)
   - Tax calculation error penalty: -15% if off by ₹0.01-0.10, -30% if larger
   - Base amount mismatch penalty: -10% if not matching ledger amount

#### Sample Output
```json
{
  "tax_id": "TAX_001",
  "invoice_id": "INV001",
  "tax_type": "GST",
  "tax_rate": 18.0,
  "base_amount": 1000.00,
  "tax_amount": 180.00,
  "confidence_score": 100,
  "match_tier": "tier1_tax",
  "reason": "GST 18% tax on ₹1000.00 = ₹180.00 for invoice INV001"
}
```

## API Endpoints

### 1. **GET /tax-matches**
Returns all tax matches with detailed breakdown including:
- Tax type and rate
- Base amount and calculated tax
- Associated invoice details
- Confidence scores

**Response Example**:
```json
[
  {
    "tax_id": "TAX_001",
    "invoice_id": "INV001",
    "tax_type": "GST",
    "tax_rate": 18.0,
    "base_amount": 1000.00,
    "tax_amount": 180.00,
    "invoice_amount": 1180.00,
    "customer_name": "Acme Corp",
    "confidence_score": 100,
    "match_tier": "tier1_tax"
  }
]
```

### 2. **GET /tax-summary**
Returns comprehensive summary statistics for tax reconciliation:
- Total tax records and matched records
- Match rate percentage
- Total tax amount and matched amount
- Breakdown by tax type

**Response Example**:
```json
{
  "total_tax_records": 8,
  "matched_tax_records": 8,
  "match_rate": 100.0,
  "total_tax_amount": 1615.00,
  "matched_tax_amount": 1615.00,
  "tax_by_type": [
    {
      "tax_type": "GST",
      "count": 4,
      "total_amount": 630.00
    },
    {
      "tax_type": "VAT",
      "count": 2,
      "total_amount": 675.00
    },
    {
      "tax_type": "Income_Tax",
      "count": 2,
      "total_amount": 310.00
    }
  ]
}
```

## Frontend Components

### TaxMatches Component
Located in `frontend/src/components/TaxMatches.jsx`

**Features**:
- **Tax Summary Cards**: Display key metrics at a glance
  - Total tax records
  - Matched records count
  - Match rate percentage
  - Total matched tax amount

- **Tax Breakdown Table**: Shows tax distribution by type
  - Tax type (GST, VAT, Income Tax, etc.)
  - Number of records per type
  - Total amount per tax type

- **Tax Matches Table**: Detailed view of all matches with:
  - Tax ID and type
  - Tax rate (%)
  - Base and tax amounts
  - Associated invoice ID
  - Confidence score with color coding
  - Match reason/details

**Color Coding**:
- 🟢 Green (95%+): High confidence match
- 🟡 Yellow (80-94%): Medium confidence
- 🔴 Red (<80%): Low confidence (requires review)

## Integration with Reconciliation Pipeline

The tax matching runs as **Tier 1 Tax** in the reconciliation pipeline:

```
Reconciliation Pipeline:
├── Tier 1 (Exact) - Bank/Settlement/Ledger matching
├── Tier 1 (Split) - Multi-leg settlement matching
├── Tier 1 (Tax) - Tax record matching ← NEW
├── Tier 2 (LLM) - Fuzzy matching for leftovers
└── Exception Flagging - Unresolved records
```

## Data Format for tax.csv

```csv
tax_id,invoice_id,tax_date,tax_type,tax_rate,base_amount,tax_amount,description
TAX_001,INV001,2024-01-15,GST,18.0,1000.00,180.00,GST on service delivery
TAX_002,INV002,2024-01-16,GST,18.0,500.00,90.00,GST on consulting
TAX_003,INV003,2024-01-17,VAT,15.0,2000.00,300.00,VAT on goods sold
TAX_004,INV004,2024-01-18,Income_Tax,10.0,5000.00,500.00,TDS on payment
```

## Usage Instructions

### Step 1: Prepare Tax Data
Create a `backend/tax.csv` file with your tax records following the format above.

### Step 2: Run Reconciliation
```bash
cd backend
python load_data.py  # Loads all data including tax.csv
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### Step 3: View Tax Matches
1. Open the frontend: `http://localhost:3000`
2. Click on "Tax Matches" tab in the dashboard
3. Review the summary statistics and detailed matches
4. Analyze confidence scores and verify calculations

### Step 4: Monitor via API
Fetch tax data programmatically:
```bash
# Get all tax matches
curl http://localhost:8000/tax-matches

# Get tax summary
curl http://localhost:8000/tax-summary
```

## Audit Trail

All tax matching decisions are logged in the `audit_log` table with:
- Action: `match_success` or `match_attempt`
- Tax ID, Invoice ID, and tax type
- Confidence score
- Reason for match decision
- Tier: `tier1_tax`

## Example Scenarios

### Scenario 1: Simple GST Matching ✅
```
Invoice: INV001, Amount: ₹1,000
Tax Record: TAX_001, Type: GST 18%, Base: ₹1,000, Tax: ₹180
Result: 100% confidence match
```

### Scenario 2: Date Drift Handling ⚠️
```
Invoice Date: 2024-01-15
Tax Date: 2024-01-17 (2-day drift)
Result: 90% confidence (penalty applied for drift)
```

### Scenario 3: Tax Calculation Error Detection 🚨
```
Expected Tax: ₹180 (1000 × 18%)
Actual Tax Amount: ₹185 (₹5 discrepancy)
Result: 65% confidence (significant penalty)
```

## Next Steps & Enhancements

1. **Multi-Tax per Invoice**: Support multiple tax types on a single invoice
2. **GST Refund Matching**: Match input/output GST credit tracking
3. **Tax Timeline Analysis**: Track tax accrual vs. payment timing
4. **Tax Exception Automation**: Auto-flag unusual tax amounts or rates
5. **Tax Report Generation**: Generate tax reconciliation reports for compliance

## Troubleshooting

### Issue: Tax records not loading
**Solution**: Verify `tax.csv` exists in the `backend/` folder and matches the format

### Issue: Low confidence scores
**Solution**: Check for date mismatches or tax calculation errors in source data

### Issue: Endpoint returns 404
**Solution**: Ensure backend is running and tax feature is enabled in the latest code

## Files Modified/Created

- ✅ `backend/schema.sql` - Added `tax_txns` table
- ✅ `backend/load_data.py` - Added tax CSV loading
- ✅ `backend/matching_engine.py` - Added `run_tax_match()` function
- ✅ `backend/main.py` - Added `/tax-matches` and `/tax-summary` endpoints
- ✅ `backend/tax.csv` - Sample tax data file
- ✅ `frontend/src/components/TaxMatches.jsx` - New UI component
- ✅ `frontend/src/App.jsx` - Integrated TaxMatches component

## Support

For questions or issues with the tax line matcher, please refer to the audit trail logs or contact the reconciliation team.

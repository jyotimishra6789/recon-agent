"""
Synthetic data generator for the reconciliation demo.

Generates three related-but-messy datasets (bank / settlement / ledger)
with deliberately injected mismatch patterns so the matching engine has
real work to do:

  - clean matches            (~60%)
  - fee deductions            (settlement amount < ledger amount)
  - settlement delay          (date offset by 1-2 days)
  - missing counterpart       (present in one source, absent in another)
  - duplicate entries         (same txn logged twice)
  - amount typo               (small unexplained difference)

Run: python generate_data.py --count 60
Writes: bank.csv, settlement.csv, ledger.csv
"""

import csv
import random
import argparse
from datetime import date, timedelta

RNG = random.Random(42)  # fixed seed -> reproducible demo data


def rand_date(start: date, spread_days: int = 14) -> date:
    return start + timedelta(days=RNG.randint(0, spread_days))


def make_dataset(count: int):
    bank_rows, settlement_rows, ledger_rows = [], [], []
    start = date(2026, 8, 1)

    clean_n = int(count * 0.60)
    fee_n = int(count * 0.15)
    delay_n = int(count * 0.10)
    missing_n = int(count * 0.08)
    dup_n = int(count * 0.04)
    typo_n = count - (clean_n + fee_n + delay_n + missing_n + dup_n)

    idx = 1

    def add_clean():
        nonlocal idx
        d = rand_date(start)
        amt = round(RNG.uniform(500, 20000), 2)
        ref, oid, inv = f"TXN{10000+idx}", f"ORD{5000+idx}", f"INV{9000+idx}"
        bank_rows.append([ref, d.isoformat(), amt, "UPI/NEFT settlement"])
        settlement_rows.append([oid, d.isoformat(), amt, amt, 0])
        ledger_rows.append([inv, d.isoformat(), amt, f"Customer{idx}"])
        idx += 1

    def add_fee_deduction():
        nonlocal idx
        d = rand_date(start)
        gross = round(RNG.uniform(1000, 15000), 2)
        fee = round(gross * RNG.uniform(0.015, 0.025), 2)  # ~1.5-2.5% RZP fee
        net = round(gross - fee, 2)
        ref, oid, inv = f"TXN{10000+idx}", f"ORD{5000+idx}", f"INV{9000+idx}"
        bank_rows.append([ref, d.isoformat(), net, "UPI/NEFT settlement"])
        settlement_rows.append([oid, d.isoformat(), net, gross, fee])
        ledger_rows.append([inv, d.isoformat(), gross, f"Customer{idx}"])  # ledger books gross
        idx += 1

    def add_settlement_delay():
        nonlocal idx
        d = rand_date(start)
        delay = RNG.choice([1, 2])
        amt = round(RNG.uniform(500, 20000), 2)
        ref, oid, inv = f"TXN{10000+idx}", f"ORD{5000+idx}", f"INV{9000+idx}"
        bank_rows.append([ref, d.isoformat(), amt, "UPI/NEFT settlement"])
        settlement_rows.append([oid, d.isoformat(), amt, amt, 0])
        ledger_rows.append([inv, (d + timedelta(days=delay)).isoformat(), amt, f"Customer{idx}"])
        idx += 1

    def add_missing_counterpart():
        nonlocal idx
        d = rand_date(start)
        amt = round(RNG.uniform(500, 20000), 2)
        ref, oid, inv = f"TXN{10000+idx}", f"ORD{5000+idx}", f"INV{9000+idx}"
        which = RNG.choice(["bank_only", "ledger_only", "settlement_only"])
        if which == "bank_only":
            bank_rows.append([ref, d.isoformat(), amt, "Unmatched bank credit"])
        elif which == "ledger_only":
            ledger_rows.append([inv, d.isoformat(), amt, f"Customer{idx}"])
        else:
            settlement_rows.append([oid, d.isoformat(), amt, amt, 0])
        idx += 1

    def add_duplicate():
        nonlocal idx
        d = rand_date(start)
        amt = round(RNG.uniform(500, 20000), 2)
        ref, oid, inv = f"TXN{10000+idx}", f"ORD{5000+idx}", f"INV{9000+idx}"
        bank_rows.append([ref, d.isoformat(), amt, "UPI/NEFT settlement"])
        settlement_rows.append([oid, d.isoformat(), amt, amt, 0])
        ledger_rows.append([inv, d.isoformat(), amt, f"Customer{idx}"])
        idx += 1
        # duplicate ledger entry (common bookkeeping error) - reuses next inv id
        inv2 = f"INV{9000+idx}"
        ledger_rows.append([inv2, d.isoformat(), amt, f"Customer{idx}-DUPLICATE"])
        idx += 1

    def add_amount_typo():
        nonlocal idx
        d = rand_date(start)
        amt = round(RNG.uniform(500, 20000), 2)
        typo_amt = round(amt + RNG.choice([-1, 1]) * RNG.uniform(1, 8), 2)
        ref, oid, inv = f"TXN{10000+idx}", f"ORD{5000+idx}", f"INV{9000+idx}"
        bank_rows.append([ref, d.isoformat(), amt, "UPI/NEFT settlement"])
        settlement_rows.append([oid, d.isoformat(), amt, amt, 0])
        ledger_rows.append([inv, d.isoformat(), typo_amt, f"Customer{idx}"])  # small unexplained diff
        idx += 1

    generators = (
        [add_clean] * clean_n
        + [add_fee_deduction] * fee_n
        + [add_settlement_delay] * delay_n
        + [add_missing_counterpart] * missing_n
        + [add_duplicate] * dup_n
        + [add_amount_typo] * typo_n
    )
    RNG.shuffle(generators)
    for gen in generators:
        gen()

    return bank_rows, settlement_rows, ledger_rows


def write_csv(path, header, rows):
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=60, help="approx number of base transactions")
    parser.add_argument("--outdir", type=str, default=".")
    args = parser.parse_args()

    bank, settlement, ledger = make_dataset(args.count)

    write_csv(f"{args.outdir}/bank.csv", ["ref_id", "txn_date", "amount", "description"], bank)
    write_csv(f"{args.outdir}/settlement.csv", ["order_id", "settle_date", "amount", "gross_amount", "fee"], settlement)
    write_csv(f"{args.outdir}/ledger.csv", ["invoice_id", "invoice_date", "amount", "customer_name"], ledger)

    print(f"Generated: {len(bank)} bank rows, {len(settlement)} settlement rows, {len(ledger)} ledger rows")
    print(f"Written to {args.outdir}/bank.csv, settlement.csv, ledger.csv")
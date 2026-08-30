"""Load bank.csv / settlement.csv / ledger.csv into recon.db using schema.sql"""
import sqlite3
import csv
import os

BASE = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE, "recon.db")


def load():
    conn = sqlite3.connect(DB_PATH)
    with open(os.path.join(BASE, "schema.sql")) as f:
        conn.executescript(f.read())

    with open(os.path.join(BASE, "bank.csv")) as f:
        rows = list(csv.DictReader(f))
        conn.executemany(
            "INSERT INTO bank_txns (ref_id, txn_date, amount, description) VALUES (:ref_id, :txn_date, :amount, :description)",
            rows,
        )

    with open(os.path.join(BASE, "settlement.csv")) as f:
        rows = list(csv.DictReader(f))
        conn.executemany(
            """INSERT INTO settlement_txns (order_id, settle_date, amount, gross_amount, fee)
               VALUES (:order_id, :settle_date, :amount, :gross_amount, :fee)""",
            rows,
        )

    with open(os.path.join(BASE, "ledger.csv")) as f:
        rows = list(csv.DictReader(f))
        conn.executemany(
            "INSERT INTO ledger_txns (invoice_id, invoice_date, amount, customer_name) VALUES (:invoice_id, :invoice_date, :amount, :customer_name)",
            rows,
        )

    # Load tax data if available
    tax_file = os.path.join(BASE, "tax.csv")
    if os.path.exists(tax_file):
        with open(tax_file) as f:
            rows = list(csv.DictReader(f))
            conn.executemany(
                """INSERT INTO tax_txns (tax_id, invoice_id, tax_date, tax_type, tax_rate, base_amount, tax_amount, description)
                   VALUES (:tax_id, :invoice_id, :tax_date, :tax_type, :tax_rate, :base_amount, :tax_amount, :description)""",
                rows,
            )

    conn.commit()
    counts = {
        t: conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        for t in ("bank_txns", "settlement_txns", "ledger_txns")
    }
    tax_count = conn.execute("SELECT COUNT(*) FROM tax_txns").fetchone()[0]
    conn.close()
    print("Loaded:", counts)
    if tax_count > 0:
        print(f"Tax records: {tax_count}")


if __name__ == "__main__":
    load()
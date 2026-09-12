"""Export a read-only SQLite snapshot to verified, Excel-compatible CSV files."""

import argparse
import csv
import hashlib
import json
import re
import sqlite3
from datetime import datetime, timezone
from itertools import zip_longest
from pathlib import Path


def identifier(name):
    return '"' + name.replace('"', '""') + '"'


def csv_value(value):
    if value is None:
        return ""
    if isinstance(value, bytes):
        return "hex:" + value.hex()
    return str(value)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("database", type=Path)
    parser.add_argument("--inspect", action="store_true")
    args = parser.parse_args()
    source = args.database.resolve(strict=True)

    # SQLite's backup API includes committed WAL data and provides a consistent
    # snapshot without starting the application or modifying its database.
    live = sqlite3.connect(source.as_uri() + "?mode=ro", uri=True, timeout=30)
    snapshot = sqlite3.connect(":memory:")
    try:
        live.backup(snapshot)
    finally:
        live.close()

    try:
        integrity = [row[0] for row in snapshot.execute("PRAGMA integrity_check")]
        if integrity != ["ok"]:
            raise RuntimeError("Database integrity check failed: " + repr(integrity))
        tables = [row[0] for row in snapshot.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
        )]
        counts = {
            table: snapshot.execute(
                "SELECT COUNT(*) FROM " + identifier(table)
            ).fetchone()[0]
            for table in tables
        }
        print(json.dumps({"source": str(source), "integrity": "ok", "tables": counts}, indent=2))
        if args.inspect:
            return

        created = datetime.now(timezone.utc)
        export_root = Path(__file__).resolve().parent.parent / "exports"
        export_root.mkdir(exist_ok=True)
        output = export_root / ("database_csv_export_" + created.strftime("%Y%m%d_%H%M%S_%f"))
        output.mkdir(exist_ok=False)
        manifest = {
            "source_database": str(source),
            "created_at_utc": created.isoformat(),
            "snapshot_method": "SQLite read-only connection and in-memory backup, including committed WAL data",
            "integrity_check": "ok",
            "encoding": "UTF-8 with BOM (Excel compatible)",
            "null_encoding": "Empty field; CSV alone does not distinguish NULL from empty text",
            "blob_encoding": "hex: followed by hexadecimal bytes",
            "tables": [],
        }
        schema = [row[0] + ";" for row in snapshot.execute(
            "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name"
        )]
        (output / "schema.sql").write_text("\n\n".join(schema) + "\n", encoding="utf-8")

        used_names = set()
        for index, table in enumerate(tables, 1):
            filename = re.sub(r'[^\w.-]', '_', table).strip('.') or "table"
            if filename.upper() in {"CON", "PRN", "AUX", "NUL"} or filename.lower() in used_names:
                filename = str(index) + "_" + filename
            used_names.add(filename.lower())
            target = output / (filename + ".csv")
            query = "SELECT * FROM " + identifier(table)
            cursor = snapshot.execute(query)
            columns = [column[0] for column in cursor.description]
            with target.open("w", encoding="utf-8-sig", newline="") as handle:
                writer = csv.writer(handle)
                writer.writerow(columns)
                writer.writerows([csv_value(value) for value in row] for row in cursor)

            # Reparse every CSV and compare all cells against the same snapshot.
            verified_rows = 0
            with target.open("r", encoding="utf-8-sig", newline="") as handle:
                reader = csv.reader(handle)
                if next(reader) != columns:
                    raise RuntimeError("CSV header mismatch: " + table)
                for actual, expected in zip_longest(reader, snapshot.execute(query)):
                    if expected is None or actual != [csv_value(value) for value in expected]:
                        raise RuntimeError("CSV data mismatch: " + table)
                    verified_rows += 1
            if verified_rows != counts[table]:
                raise RuntimeError("CSV row count mismatch: " + table)
            manifest["tables"].append({
                "table": table,
                "file": target.name,
                "columns": columns,
                "rows": verified_rows,
                "verified": True,
                "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
            })

        (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        (output / "README.txt").write_text(
            "CSV copy of " + str(source) + "\n\n"
            "One CSV per table, including empty tables (headers only) and SQLite sequence metadata.\n"
            "Open assets.csv for the IT inventory. Files use UTF-8 with BOM for Excel.\n"
            "Every exported cell and row count was verified against a consistent SQLite snapshot.\n"
            "manifest.json lists columns, counts, checksums, and export details.\n"
            "schema.sql records table definitions, indexes, views, and triggers.\n"
            "NULL is exported as an empty field; binary data uses hex: followed by hexadecimal bytes.\n"
            "CSV preserves table data as text, not SQLite types or database constraints.\n",
            encoding="utf-8",
        )
        print("Verified CSV export: " + str(output))
        print("Total rows: " + str(sum(counts.values())))
    finally:
        snapshot.close()


if __name__ == "__main__":
    main()

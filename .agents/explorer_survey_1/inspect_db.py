import sqlite3
import json

con = sqlite3.connect('database.db')
cursor = con.cursor()

print("=== TABLES & SCHEMA ===")
for row in cursor.execute("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name"):
    print(f"[{row[0]}] {row[1]}:\n{row[2]}\n")

print("=== PRAGMA foreign_key_list ===")
for table in ['assets', 'transactions', 'employees', 'users', 'print_logs']:
    fks = cursor.execute(f"PRAGMA foreign_key_list({table})").fetchall()
    print(f"FKs for {table}: {fks}")

print("=== PRAGMA index_list ===")
for table in ['assets', 'transactions', 'employees', 'users', 'print_logs']:
    idxs = cursor.execute(f"PRAGMA index_list({table})").fetchall()
    print(f"Indexes for {table}: {idxs}")

print("=== USERS IN DB ===")
users = cursor.execute("SELECT id, username, role FROM users").fetchall()
print(f"Users: {users}")

print("=== ASSET STATUS DISTINCT VALUES ===")
statuses = cursor.execute("SELECT DISTINCT status FROM assets").fetchall()
print(f"Asset statuses: {statuses}")

print("=== TRANSACTION TYPES ===")
types = cursor.execute("SELECT DISTINCT type FROM transactions").fetchall()
print(f"Transaction types: {types}")

import os
import re

def search_files(dir_path, pattern):
    regex = re.compile(pattern, re.IGNORECASE)
    results = []
    for root, dirs, files in os.walk(dir_path):
        for file in files:
            if file.endswith(('.js', '.html', '.css', '.py')):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        for line_num, line in enumerate(f, 1):
                            if regex.search(line):
                                results.append((filepath, line_num, line.strip()))
                except Exception as e:
                    pass
    return results

print("=== SEARCH FOR STATUS IN Public/js ===")
for r in search_files('Public/js', r'status'):
    if any(k in r[2].lower() for k in ['in stock', 'assigned', 'faulty', 'scrap', 'select', 'filter']):
        print(f"{r[0]}:{r[1]} -> {r[2]}")

print("\n=== SEARCH FOR CSV / IMPORT IN Public/js ===")
for r in search_files('Public/js', r'(csv|import|parse|export)'):
    print(f"{r[0]}:{r[1]} -> {r[2]}")

print("\n=== SEARCH FOR MODAL / FORMS IN Public/index.html ===")
for r in search_files('Public', r'id=".*modal.*"'):
    print(f"{r[0]}:{r[1]} -> {r[2]}")

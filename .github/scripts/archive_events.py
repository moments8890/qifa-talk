#!/usr/bin/env python3
"""
Moves upcoming event files to past/ when their event_date has passed.
Event date format: "M/D/YYYY" (e.g. "3/8/2026")
"""

import os
import re
import shutil
from datetime import date, datetime

UPCOMING_DIR = "qifa-talk/upcoming"
PAST_DIR = "qifa-talk/past"
today = date.today()

def parse_event_date(value):
    """Parse date strings like '3/8/2026' or '3/8/2026 2pm'."""
    value = value.strip().strip('"').strip("'")
    # take only the date part before any space
    date_part = value.split()[0]
    try:
        return datetime.strptime(date_part, "%m/%d/%Y").date()
    except ValueError:
        return None

def update_parent(content):
    """Replace parent: 即将开始 with parent: 往期活动."""
    return re.sub(
        r'^(parent:\s*)即将开始',
        r'\1往期活动',
        content,
        flags=re.MULTILINE
    )

archived = []

for filename in os.listdir(UPCOMING_DIR):
    if not filename.endswith(".md") or filename == "index.md":
        continue

    filepath = os.path.join(UPCOMING_DIR, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    match = re.search(r'^event_date:\s*(.+)$', content, re.MULTILINE)
    if not match:
        continue

    event_date = parse_event_date(match.group(1))
    if event_date is None:
        print(f"  [skip] {filename}: could not parse date '{match.group(1)}'")
        continue

    if event_date < today:
        new_content = update_parent(content)
        dest = os.path.join(PAST_DIR, filename)
        with open(dest, "w", encoding="utf-8") as f:
            f.write(new_content)
        os.remove(filepath)
        archived.append((filename, str(event_date)))
        print(f"  [archived] {filename} ({event_date})")

if archived:
    print(f"\nArchived {len(archived)} event(s):")
    for name, d in archived:
        print(f"  - {name} ({d})")
else:
    print("No events to archive.")

"""sql/ 의 분석 쿼리를 순서대로 실행하고, 결과표를 output/ 에 CSV 로 저장한다.

사용법:
  export PG_DSN="postgresql://postgres@localhost:5432/movielens"
  python scripts/02_run_analysis.py
"""
import csv
import os
import re
from pathlib import Path

import psycopg

DSN = os.environ.get("PG_DSN", "postgresql://postgres@localhost:5432/movielens")
FILES = ["02_validation", "03_movie_stats", "04_concentration", "05_threshold", "06_proposal"]
OUT = Path("output")
OUT.mkdir(exist_ok=True)


def statements(sql: str):
    """주석 줄을 지우고 ';' 기준으로 쿼리를 나눈다. [V1] 같은 태그를 결과 파일 이름으로 쓴다."""
    for chunk in sql.split(";"):
        tag = re.search(r"--\s*\[(\w+)\]", chunk)
        body = "\n".join(l for l in chunk.splitlines() if not l.strip().startswith("--")).strip()
        if body:
            yield (tag.group(1) if tag else None), body


with psycopg.connect(DSN, autocommit=True) as conn:
    for f in FILES:
        for tag, q in statements(Path(f"sql/{f}.sql").read_text(encoding="utf-8")):
            cur = conn.execute(q)
            if cur.description and tag:  # SELECT 결과만 저장
                path = OUT / f"{f}_{tag}.csv"
                with open(path, "w", newline="", encoding="utf-8") as g:
                    w = csv.writer(g)
                    w.writerow([c.name for c in cur.description])
                    w.writerows(cur.fetchall())
                print("saved:", path)

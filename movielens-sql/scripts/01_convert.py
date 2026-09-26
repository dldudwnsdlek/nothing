"""MovieLens 1M 의 '::' 구분 .dat 파일을 PostgreSQL 에 적재할 수 있는 UTF-8 CSV 로 변환."""
import csv
from pathlib import Path

SRC, DST = Path("data/ml-1m"), Path("data/csv")
DST.mkdir(parents=True, exist_ok=True)
SPEC = {
    "ratings": ["user_id", "movie_id", "rating", "rated_at_unix"],
    "movies":  ["movie_id", "title", "genres"],
    "users":   ["user_id", "gender", "age", "occupation", "zip_code"],
}
for name, cols in SPEC.items():
    with open(SRC / f"{name}.dat", encoding="latin-1") as f, \
         open(DST / f"{name}.csv", "w", newline="", encoding="utf-8") as g:
        w = csv.writer(g)
        w.writerow(cols)
        n = 0
        for line in f:
            w.writerow(line.rstrip("\n").split("::"))
            n += 1
    print(f"{name}: {n:,} rows")

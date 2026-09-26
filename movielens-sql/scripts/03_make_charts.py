"""output/ 의 분석 결과 CSV 로 README 용 차트를 그린다 (images/*.png)."""
import csv
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = Path("images")
OUT.mkdir(exist_ok=True)

SURFACE, INK, INK_2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3df"
SERIES_1, SERIES_2 = "#2a78d6", "#eb6834"

plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE,
    "axes.edgecolor": GRID, "axes.labelcolor": INK_2, "text.color": INK,
    "xtick.color": INK_2, "ytick.color": INK_2, "font.size": 10,
    "axes.spines.top": False, "axes.spines.right": False,
})


def read(name):
    with open(f"output/{name}.csv", encoding="utf-8") as f:
        return list(csv.DictReader(f))


# 1) 최소 평가 수 기준별: 남는 영화 비율 vs 남는 평점 비율
rows = read("05_threshold_T1")
x = [int(r["min_n"]) for r in rows]
movies = [float(r["kept_movie_pct"]) for r in rows]
ratings = [float(r["kept_rating_pct"]) for r in rows]

fig, ax = plt.subplots(figsize=(7.2, 4.0), dpi=150)
ax.plot(x, ratings, color=SERIES_1, lw=2, marker="o", ms=5, label="Ratings kept")
ax.plot(x, movies, color=SERIES_2, lw=2, marker="o", ms=5, label="Movies kept")
ax.axvline(50, color=INK_2, lw=1, ls=(0, (3, 3)))
ax.annotate("min 50 ratings\nmovies 64.7% / ratings 97.8%", xy=(50, 64.7), xytext=(100, 68),
            color=INK_2, fontsize=9, arrowprops=dict(arrowstyle="-", color=INK_2, lw=0.8))
ax.text(x[-1] + 4, ratings[-1], "Ratings", color=INK, va="center", fontsize=9)
ax.text(x[-1] + 4, movies[-1], "Movies", color=INK, va="center", fontsize=9)
ax.set_xlim(0, 225)
ax.set_ylim(0, 105)
ax.set_xlabel("Minimum number of ratings per movie")
ax.set_ylabel("% kept")
ax.grid(axis="y", color=GRID, lw=0.8)
ax.legend(frameon=False, loc="lower right")
ax.set_title("Raising the threshold drops movies much faster than ratings", loc="left", fontsize=11)
fig.tight_layout()
fig.savefig(OUT / "threshold_tradeoff.png")
plt.close(fig)

# 2) 장르별: 50건 기준 적용 시 후보로 남는 영화 비율
rows = sorted(read("05_threshold_T2"), key=lambda r: float(r["kept_pct_at_50"]))
genres = [r["genre"] for r in rows]
kept = [float(r["kept_pct_at_50"]) for r in rows]

fig, ax = plt.subplots(figsize=(7.2, 5.2), dpi=150)
bars = ax.barh(genres, kept, color=SERIES_1, height=0.62)
for b, v in zip(bars, kept):
    ax.text(v + 1, b.get_y() + b.get_height() / 2, f"{v:.1f}%", va="center", fontsize=8.5, color=INK_2)
ax.set_xlim(0, 100)
ax.set_xlabel("% of movies kept at min 50 ratings")
ax.grid(axis="x", color=GRID, lw=0.8)
ax.set_axisbelow(True)
ax.set_title("A single threshold hits genres unevenly", loc="left", fontsize=11)
fig.tight_layout()
fig.savefig(OUT / "genre_kept_at_50.png")
plt.close(fig)

print("saved:", *sorted(p.name for p in OUT.glob("*.png")))

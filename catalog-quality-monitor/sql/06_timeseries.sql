-- 06_timeseries.sql : ★ LAG — 월별 시계열이 있는 곳에서 쓴다 (2개 시점 비교는 JOIN이 더 자연스럽다)

-- (A) 외식비: 시도 x 품목별 전월 대비(MoM) / 전년 동월 대비(YoY)
WITH t AS (
    SELECT sido, item, month, avg_price,
           LAG(avg_price, 1)  OVER (PARTITION BY sido, item ORDER BY month) AS prev_month,
           LAG(avg_price, 12) OVER (PARTITION BY sido, item ORDER BY month) AS prev_year
    FROM stg_eatout
)
SELECT sido, item, month, avg_price,
       ROUND(100.0 * (avg_price - prev_month) / prev_month, 1) AS mom_pct,
       ROUND(100.0 * (avg_price - prev_year)  / prev_year, 1)  AS yoy_pct,
       -- 같은 품목의 전국(=모든 시도) YoY 중앙값과의 차이. +5%p 이상이면 '급등 지역'으로 본다 (여기서는 정렬만)
       ROUND(100.0 * (avg_price - prev_year) / prev_year
             - MEDIAN(100.0 * (avg_price - prev_year) / prev_year) OVER (PARTITION BY item, month), 1) AS yoy_gap_vs_nation
FROM t
WHERE month = (SELECT MAX(month) FROM stg_eatout)
ORDER BY yoy_gap_vs_nation DESC
LIMIT 10;

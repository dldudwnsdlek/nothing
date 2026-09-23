-- 07_restaurant.sql : 일반음식점 인허가 = '전체 공급(입점) 풀'. 월별 개업/폐업 KPI + 이상 징후 탐지
CREATE OR REPLACE TABLE raw_restaurant AS
SELECT * FROM read_csv('data/restaurant_license.csv', all_varchar = true);

CREATE OR REPLACE TABLE stg_restaurant AS
SELECT 관리번호 AS license_id,
       -- 날짜가 '20240131' 또는 '2024-01-31' 어느 쪽으로 와도 읽히게
       coalesce(TRY_CAST(인허가일자 AS DATE), CAST(TRY_STRPTIME(인허가일자, '%Y%m%d') AS DATE)) AS open_date,
       coalesce(TRY_CAST(폐업일자  AS DATE), CAST(TRY_STRPTIME(폐업일자,  '%Y%m%d') AS DATE)) AS close_date,
       영업상태명 AS status, 사업장명 AS name, 업태구분명 AS biz_type,
       nullif(trim(소재지전화), '')     AS phone,
       nullif(trim(도로명전체주소), '') AS road_addr,
       TRY_CAST("좌표정보x(epsg5174)" AS DOUBLE) AS x,
       TRY_CAST("좌표정보y(epsg5174)" AS DOUBLE) AS y
FROM raw_restaurant;

-- (A) 월별 개업·폐업 수 → LAG로 전월비, 이동평균·이동표준편차로 이상 월 탐지
WITH months AS (      -- 날짜 뼈대: 개업/폐업이 0건인 달도 행이 있어야 LAG가 '바로 전 달'을 가리킨다
    SELECT CAST(range AS DATE) AS month
    FROM range(DATE '2019-01-01', DATE '2026-09-01', INTERVAL 1 MONTH)
),
opens  AS (SELECT DATE_TRUNC('month', open_date)  AS month, COUNT(*) AS n FROM stg_restaurant GROUP BY 1),
closes AS (SELECT DATE_TRUNC('month', close_date) AS month, COUNT(*) AS n FROM stg_restaurant WHERE close_date IS NOT NULL GROUP BY 1),
kpi AS (
    SELECT m.month,
           coalesce(o.n, 0) AS opened,
           coalesce(c.n, 0) AS closed
    FROM months m
    LEFT JOIN opens  o ON o.month = m.month
    LEFT JOIN closes c ON c.month = m.month
),
scored AS (
    SELECT *,
        LAG(closed) OVER (ORDER BY month) AS closed_prev,
        AVG(closed)    OVER (ORDER BY month ROWS BETWEEN 12 PRECEDING AND 1 PRECEDING) AS closed_ma12,   -- 직전 12개월(이번 달 제외)
        STDDEV(closed) OVER (ORDER BY month ROWS BETWEEN 12 PRECEDING AND 1 PRECEDING) AS closed_sd12
    FROM kpi
)
SELECT month, opened, closed, closed_prev,
       ROUND(100.0 * (closed - closed_prev) / NULLIF(closed_prev, 0), 1) AS closed_mom_pct,
       ROUND((closed - closed_ma12) / NULLIF(closed_sd12, 0), 2)          AS closed_z,
       CASE WHEN (closed - closed_ma12) / NULLIF(closed_sd12, 0) >= 3 THEN '폐업급증_원인분석' END AS alert
FROM scored
WHERE month >= DATE '2020-01-01'
ORDER BY closed_z DESC NULLS LAST
LIMIT 5;

-- (B) 레코드 품질 검사 (대용량 완결성·논리 정합성)
SELECT COUNT(*) AS total,
    ROUND(100.0 * AVG(CASE WHEN phone IS NULL     THEN 1 ELSE 0 END), 1) AS phone_missing_pct,
    ROUND(100.0 * AVG(CASE WHEN road_addr IS NULL THEN 1 ELSE 0 END), 1) AS road_addr_missing_pct,
    ROUND(100.0 * AVG(CASE WHEN x IS NULL OR y IS NULL THEN 1 ELSE 0 END), 1) AS coord_missing_pct,
    SUM(CASE WHEN status LIKE '%폐업%' AND close_date IS NULL THEN 1 ELSE 0 END) AS closed_but_no_date,  -- 상태와 날짜가 모순
    SUM(CASE WHEN close_date < open_date                   THEN 1 ELSE 0 END) AS close_before_open,
    SUM(CASE WHEN biz_type = '한식' AND regexp_matches(name, '커피|카페') THEN 1 ELSE 0 END) AS type_name_conflict
FROM stg_restaurant;

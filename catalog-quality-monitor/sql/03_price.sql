-- 03_price.sql : 축1 가격 경쟁력
-- 왜: 착한가격업소의 지정 기준은 '지역 평균 가격 이하'. 등록된 가격이 실제로 지역 평균보다 싼지 = 카탈로그의 가격 경쟁력 모니터링과 같은 구조

-- (1) 메뉴 표준화 규칙: 자유 텍스트 메뉴명 → 외식비 대표 품목 (삼겹살은 조사 단위가 달라 제외)
CREATE OR REPLACE TABLE dim_menu_rule AS
SELECT * FROM (VALUES
  ('%김치찌개%', '김치찌개백반', 1), ('%김치찌게%', '김치찌개백반', 1),   -- 오타도 규칙으로 흡수
  ('%냉면%',     '냉면',   2),
  ('%비빔밥%',   '비빔밥', 3),
  ('%짜장%',     '자장면', 4), ('%자장%', '자장면', 4),
  ('%삼계탕%',   '삼계탕', 5),
  ('%칼국수%',   '칼국수', 6),
  ('%김밥%',     '김밥',   7)                                         -- '냉면김밥세트'처럼 둘 다 걸리면 숫자가 작은 규칙 1개만
) AS t(pattern, std_item, priority);

-- (2) 비등가 조인(LIKE로 JOIN) + ROW_NUMBER로 메뉴당 규칙 1개만 선택
CREATE OR REPLACE TABLE fct_menu_price AS
WITH matched AS (
    SELECT m.*, r.std_item,
           ROW_NUMBER() OVER (PARTITION BY m.store_key, m.menu_no ORDER BY r.priority) AS rn
    FROM stg_menu m
    JOIN dim_menu_rule r ON m.menu_name LIKE r.pattern
    WHERE m.price IS NOT NULL
      AND NOT (r.std_item = '자장면' AND m.menu_name LIKE '%밥%')     -- '짜장밥'은 자장면이 아님
)
SELECT mt.store_key, mt.sido, mt.sigungu, mt.category, mt.store_name, mt.menu_name, mt.std_item, mt.price,
       e.avg_price AS region_avg,
       ROUND(100.0 * (e.avg_price - mt.price) / e.avg_price, 1) AS discount_pct          -- +면 지역 평균보다 쌈
FROM matched mt
LEFT JOIN stg_eatout e
       ON e.sido = mt.sido AND e.item = mt.std_item
      AND e.month = DATE_TRUNC('month', mt.snapshot_date)
WHERE mt.rn = 1;

-- (3) 이상 탐지: 외부 벤치마크 대비 + 내부 분포 대비를 함께 본다
SELECT *,
    CASE WHEN region_avg IS NULL           THEN '벤치마크없음'
         WHEN price > region_avg           THEN '기준초과_재심사'      -- 지역 평균보다 비싼 '착한가격' 업소
         WHEN price < region_avg * 0.4     THEN '비정상저가_입력오류의심'  -- 8000을 800으로 입력하는 유형
         ELSE '정상' END AS price_flag,
    MEDIAN(price)  OVER w AS peer_median,
    COUNT(*)       OVER w AS peer_n,
    ROUND(PERCENT_RANK() OVER (PARTITION BY sido, std_item ORDER BY price), 2) AS peer_pct_rank
FROM fct_menu_price
WINDOW w AS (PARTITION BY sido, std_item)
QUALIFY price_flag <> '정상'
ORDER BY price_flag, discount_pct;

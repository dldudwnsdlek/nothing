-- 02_eda.sql : 첫 탐색 쿼리 (결과를 README '데이터 이해' 섹션에 기록)
-- Q1. 전체 행 수 / 상점 수 / 중복 등록 의심
SELECT COUNT(*) AS rows, COUNT(DISTINCT store_key) AS stores, COUNT(*) - COUNT(DISTINCT store_key) AS dup_rows FROM stg_store;
-- Q2. 업종 분포 → 외식업만 남길 업종 목록을 여기서 결정
SELECT category, COUNT(*) AS n, ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct FROM stg_store GROUP BY category ORDER BY n DESC;
-- Q3. 시도명 매핑 누락 확인 (dim_sido에 없는 표기가 있으면 여기 나온다)
SELECT sido, COUNT(*) FROM stg_store WHERE length(sido) > 2 GROUP BY sido;
-- Q4. 가격 형식오류 샘플
SELECT price_raw, COUNT(*) FROM stg_menu WHERE NOT price_format_ok GROUP BY price_raw ORDER BY 2 DESC LIMIT 20;
-- Q5. 가장 많이 등장하는 메뉴명 Top 30 → 메뉴 표준화 사전(dim_menu_rule)의 재료
SELECT menu_name, COUNT(*) FROM stg_menu GROUP BY menu_name ORDER BY 2 DESC LIMIT 30;

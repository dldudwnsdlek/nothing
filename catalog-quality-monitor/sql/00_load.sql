-- 00_load.sql : 원본 CSV를 "있는 그대로" 적재 (raw 레이어)
-- 모든 컬럼을 문자열(VARCHAR)로 읽는다 → 타입 추론 실패로 행이 깨지는 것을 막고, 정제는 SQL로 직접 한다
CREATE OR REPLACE TABLE raw_good_price AS
SELECT *, DATE '2026-06-30' AS snapshot_date          -- 원본에 기준일자 컬럼이 없으므로 파일명에서 직접 부여
FROM read_csv('data/good_price_20260630.csv', encoding = 'cp949', all_varchar = true);

CREATE OR REPLACE TABLE raw_eatout_price AS
SELECT * FROM read_csv('data/eatout_price.csv', all_varchar = true);

-- 일반음식점(확장용) 적재는 07_restaurant.sql 맨 위에 있음 → 파일이 없어도 MVP가 돌아가도록 분리

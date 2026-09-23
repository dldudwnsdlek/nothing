-- 01_staging.sql : 정제 레이어 (stg_)
-- (1) 시도명 표준화: '서울특별시'·'서울' / '강원도'·'강원특별자치도' 등 표기 차이를 2글자 약칭으로 통일
CREATE OR REPLACE TABLE dim_sido AS
SELECT * FROM (VALUES
  ('서울특별시','서울'),('부산광역시','부산'),('대구광역시','대구'),('인천광역시','인천'),
  ('광주광역시','광주'),('대전광역시','대전'),('울산광역시','울산'),('세종특별자치시','세종'),
  ('경기도','경기'),('강원도','강원'),('강원특별자치도','강원'),('충청북도','충북'),('충청남도','충남'),
  ('전라북도','전북'),('전북특별자치도','전북'),('전라남도','전남'),('경상북도','경북'),('경상남도','경남'),
  ('제주특별자치도','제주')
) AS t(sido_full, sido);

-- (2) 상점 마스터: 한 상점 = 한 행. 원본에 ID가 없으므로 업소명+주소로 대리키(store_key)를 만든다
CREATE OR REPLACE TABLE stg_store AS
SELECT
    md5(regexp_replace(g.업소명, '\s', '', 'g') || '|' || regexp_replace(coalesce(g.주소, ''), '\s', '', 'g')) AS store_key,
    g.snapshot_date,
    coalesce(d.sido, g.시도)  AS sido,
    g.시군                    AS sigungu,
    g.업종                    AS category,
    g.업소명                  AS store_name,
    nullif(trim(g.주소), '')  AS address,
    nullif(trim(g.연락처), '') AS phone,
    g.* EXCLUDE (시도, 시군, 업종, 업소명, 주소, 연락처, snapshot_date)   -- 메뉴1~4, 가격1~4는 그대로 들고 간다
FROM raw_good_price g
LEFT JOIN dim_sido d ON g.시도 = d.sido_full;

-- (3) 메뉴 롱포맷: 메뉴1~4 / 가격1~4 가로 컬럼을 세로로 펼친다 (한 행 = 한 메뉴)
CREATE OR REPLACE TABLE stg_menu AS
WITH s AS (   -- 같은 상점이 두 번 등록된 경우 1건만 사용 (중복 자체는 완결성 지표에서 따로 센다)
    SELECT * FROM stg_store
    QUALIFY ROW_NUMBER() OVER (PARTITION BY store_key ORDER BY store_name) = 1
),
long AS (
    SELECT store_key, snapshot_date, sido, sigungu, category, store_name, 1 AS menu_no, 메뉴1 AS menu_raw, 가격1 AS price_raw FROM s
    UNION ALL SELECT store_key, snapshot_date, sido, sigungu, category, store_name, 2, 메뉴2, 가격2 FROM s
    UNION ALL SELECT store_key, snapshot_date, sido, sigungu, category, store_name, 3, 메뉴3, 가격3 FROM s
    UNION ALL SELECT store_key, snapshot_date, sido, sigungu, category, store_name, 4, 메뉴4, 가격4 FROM s
)
SELECT *,
    trim(menu_raw) AS menu_name,
    -- 가격 형식 검사: '8000', '8,000', '8,000원'만 정상으로 인정. '7,000~8,000' 같은 범위값은 형식오류로 분리
    regexp_matches(coalesce(price_raw, ''), '^\s*[0-9][0-9,]*\s*원?\s*$') AS price_format_ok,
    CASE WHEN regexp_matches(coalesce(price_raw, ''), '^\s*[0-9][0-9,]*\s*원?\s*$')
         THEN TRY_CAST(regexp_replace(price_raw, '[^0-9]', '', 'g') AS INTEGER) END AS price
FROM long
WHERE nullif(trim(menu_raw), '') IS NOT NULL OR nullif(trim(price_raw), '') IS NOT NULL;   -- 둘 다 빈 칸인 슬롯은 버림

-- (4) 외식비 벤치마크 (시도 x 품목 x 월)
CREATE OR REPLACE TABLE stg_eatout AS
SELECT CAST(기준월 || '-01' AS DATE) AS month, 시도 AS sido, 품목 AS item, CAST(평균가격 AS INTEGER) AS avg_price
FROM raw_eatout_price;

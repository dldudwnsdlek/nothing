-- 04_completeness.sql : 축2 정보 완결성 (쿠팡이츠의 '이미지 품질'처럼 "보여줄 정보가 충분한가"를 대신 재는 축)
-- 주의: 연락처 공란은 원본 비고에 '개인정보로 제외'라고 명시 → 상점 잘못이 아니므로 품질 점수에서 뺀다
CREATE OR REPLACE TABLE fct_store_quality AS
WITH menu_stat AS (
    SELECT store_key,
           COUNT(*)                                            AS menu_cnt,
           SUM(CASE WHEN menu_name IS NULL OR menu_name = '' THEN 1 ELSE 0 END) AS menu_name_missing,
           SUM(CASE WHEN price_raw IS NULL OR trim(price_raw) = '' THEN 1 ELSE 0 END) AS price_missing,
           SUM(CASE WHEN NOT price_format_ok AND trim(coalesce(price_raw,'')) <> '' THEN 1 ELSE 0 END) AS price_format_err
    FROM stg_menu
    GROUP BY store_key
)
SELECT s.store_key, s.sido, s.sigungu, s.category, s.store_name,
       COUNT(*) OVER (PARTITION BY s.store_key) - 1           AS dup_cnt,        -- 중복 등록 건수
       coalesce(m.menu_cnt, 0)                                 AS menu_cnt,
       -- 체크 5개를 각각 0/1로 → 합계 = 통과 개수
       (CASE WHEN s.address IS NOT NULL                   THEN 1 ELSE 0 END
      + CASE WHEN coalesce(m.menu_cnt, 0) >= 1            THEN 1 ELSE 0 END
      + CASE WHEN coalesce(m.menu_name_missing, 1) = 0    THEN 1 ELSE 0 END
      + CASE WHEN coalesce(m.price_missing, 1) = 0        THEN 1 ELSE 0 END
      + CASE WHEN coalesce(m.price_format_err, 0) = 0     THEN 1 ELSE 0 END) * 20 AS completeness_score
FROM stg_store s
LEFT JOIN menu_stat m USING (store_key);          -- LEFT: 메뉴가 하나도 없는 상점도 0점으로 남겨야 하므로

-- 시군 단위 요약 + 개선 우선순위 (시도별 하위 3개 시군)
WITH by_region AS (
    SELECT sido, sigungu,
           COUNT(*)                                                    AS stores,
           ROUND(AVG(completeness_score), 1)                            AS avg_score,
           ROUND(100.0 * SUM(CASE WHEN completeness_score < 80 THEN 1 ELSE 0 END) / COUNT(*), 1) AS low_quality_pct
    FROM fct_store_quality
    GROUP BY sido, sigungu
    HAVING COUNT(*) >= 10                                              -- 표본이 너무 작은 지역은 순위에서 제외
)
SELECT *, RANK() OVER (PARTITION BY sido ORDER BY avg_score ASC) AS fix_priority
FROM by_region
QUALIFY fix_priority <= 3
ORDER BY sido, fix_priority;

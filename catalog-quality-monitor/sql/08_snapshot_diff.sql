-- 08_snapshot_diff.sql : 두 분기 스냅샷 비교 (신규 등록 / 해제 / 가격 변경)
-- 다음 분기 파일(20260930)이 공개되면 00_load와 01_staging을 한 번 더 돌려 stg_store_prev / stg_store로 만든 뒤 실행
WITH prev AS (SELECT * FROM stg_store_prev QUALIFY ROW_NUMBER() OVER (PARTITION BY store_key) = 1),
     curr AS (SELECT * FROM stg_store      QUALIFY ROW_NUMBER() OVER (PARTITION BY store_key) = 1)
SELECT
    CASE WHEN p.store_key IS NULL THEN '신규등록'
         WHEN c.store_key IS NULL THEN '지정해제'
         WHEN p.가격1 IS DISTINCT FROM c.가격1 THEN '가격변경'
         ELSE '유지' END AS change_type,
    COUNT(*) AS stores
FROM prev p
FULL OUTER JOIN curr c ON p.store_key = c.store_key      -- 양쪽 어디에만 있는 상점도 모두 남긴다
GROUP BY 1
ORDER BY 2 DESC;

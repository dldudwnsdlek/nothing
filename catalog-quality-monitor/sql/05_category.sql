-- 05_category.sql : 축3 분류 정합성 — 메뉴로 추정한 업종 vs 등록 업종
WITH inferred AS (
    SELECT store_key, store_name, category, menu_name,
        CASE
            WHEN regexp_matches(menu_name, '아메리카노|라떼|커피') THEN '카페'
            WHEN regexp_matches(menu_name, '짜장|자장|짬뽕|탕수육') THEN '중식'
            WHEN regexp_matches(menu_name, '초밥|우동|돈까스|돈가스') THEN '일식'
            WHEN regexp_matches(menu_name, '파스타|스테이크|피자') THEN '양식'
            WHEN regexp_matches(menu_name, '커트|컷트|펌|염색') THEN '이미용'
        END AS inferred_cat
    FROM stg_menu
),
store_level AS (       -- 상점 단위로 모아서 "메뉴 과반이 가리키는 업종"을 추정 업종으로
    SELECT store_key, store_name, category, inferred_cat, COUNT(*) AS hits,
           STRING_AGG(menu_name, ', ') AS evidence
    FROM inferred
    WHERE inferred_cat IS NOT NULL
    GROUP BY store_key, store_name, category, inferred_cat
    QUALIFY ROW_NUMBER() OVER (PARTITION BY store_key ORDER BY hits DESC) = 1
)
SELECT category AS registered, inferred_cat AS inferred, COUNT(*) AS stores,
       STRING_AGG(store_name || '(' || evidence || ')', ' / ') AS examples
FROM store_level
-- 등록 업종 체계와 추정 체계가 다르므로 '명백히 모순'인 조합만 이상으로 본다 (예: 한식인데 커피만, 이미용인데 음식)
WHERE (category = '한식'     AND inferred_cat IN ('카페', '이미용'))
   OR (category = '중식'     AND inferred_cat IN ('카페', '일식', '이미용'))
   OR (category = '이미용업' AND inferred_cat <> '이미용')
GROUP BY 1, 2
ORDER BY stores DESC;

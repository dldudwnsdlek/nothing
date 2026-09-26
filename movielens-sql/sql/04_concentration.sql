-- [C1] 평가 수 분포 요약
SELECT COUNT(*) AS movies,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY n_ratings) AS median_ratings,
       ROUND(AVG(n_ratings)::NUMERIC, 1) AS mean_ratings,
       MAX(n_ratings) AS max_ratings
FROM movie_stats;

-- [C2] 편중도: 평가 수 상위 x% 영화가 전체 평점의 몇 %를 차지하나
WITH ranked AS (
  SELECT n_ratings,
         ROW_NUMBER() OVER (ORDER BY n_ratings DESC) AS rnk,
         COUNT(*)      OVER ()                     AS n_movies,
         SUM(n_ratings) OVER (ORDER BY n_ratings DESC ROWS UNBOUNDED PRECEDING) AS cum_ratings,
         SUM(n_ratings) OVER ()                     AS total_ratings
  FROM movie_stats
)
SELECT ROUND(100.0 * rnk / n_movies) AS top_pct_movies,
       ROUND(100.0 * cum_ratings / total_ratings, 1) AS pct_of_ratings
FROM ranked
WHERE rnk IN (CAST(n_movies * 0.01 AS INT), CAST(n_movies * 0.1 AS INT),
              CAST(n_movies * 0.2 AS INT), CAST(n_movies * 0.5 AS INT))
ORDER BY rnk;

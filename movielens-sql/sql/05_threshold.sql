-- [T1] 최소 평가 수 기준별: 후보로 남는 영화 비율 vs 남는 평점 비율
WITH th(min_n) AS (VALUES (1), (5), (10), (20), (50), (100), (200))
SELECT th.min_n,
       COUNT(*) FILTER (WHERE s.n_ratings >= th.min_n)                                       AS kept_movies,
       ROUND(100.0 * COUNT(*) FILTER (WHERE s.n_ratings >= th.min_n) / COUNT(*), 1)          AS kept_movie_pct,
       ROUND(100.0 * SUM(s.n_ratings) FILTER (WHERE s.n_ratings >= th.min_n) / SUM(s.n_ratings), 1) AS kept_rating_pct
FROM th CROSS JOIN movie_stats s
GROUP BY th.min_n
ORDER BY th.min_n;

-- [T2] 장르별 차이: 기준(50건)을 적용하면 어느 장르가 후보에서 많이 빠지나
SELECT g.genre,
       COUNT(*)                                                         AS movies,
       ROUND(100.0 * AVG(CASE WHEN s.n_ratings >= 50 THEN 1 ELSE 0 END), 1) AS kept_pct_at_50,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.n_ratings)          AS median_ratings
FROM movie_genres g JOIN movie_stats s USING (movie_id)
GROUP BY g.genre
ORDER BY kept_pct_at_50;

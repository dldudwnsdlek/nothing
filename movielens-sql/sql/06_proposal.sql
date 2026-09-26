-- [P1] 문제 확인: 단순 평균으로 순위를 매기면 상위가 평가 1~2건짜리 영화로 채워진다
SELECT title, n_ratings, avg_rating
FROM movie_stats
WHERE n_ratings > 0
ORDER BY avg_rating DESC, n_ratings DESC
LIMIT 10;

-- [P2] 제안: 평가가 적은 영화는 '버리지 않고' 전체 평균 쪽으로 보정한 점수(베이지안 평균)로 비교
--   score = (n * 영화평균 + m * 전체평균) / (n + m),  m = 기준 평가 수(여기서는 50)
WITH g AS (SELECT AVG(rating) AS global_avg FROM ratings)
SELECT title, n_ratings, avg_rating,
       ROUND(((n_ratings * avg_rating + 50 * global_avg) / (n_ratings + 50))::NUMERIC, 3) AS bayes_score
FROM movie_stats, g
WHERE n_ratings > 0
ORDER BY bayes_score DESC
LIMIT 10;

-- [P3] 단순 평균 상위 100편 중 평가 수 50건 미만 영화가 몇 편인가 (보정 전후 비교)
WITH g AS (SELECT AVG(rating) AS global_avg FROM ratings),
raw_top AS (
  SELECT movie_id, n_ratings FROM movie_stats WHERE n_ratings > 0
  ORDER BY avg_rating DESC, n_ratings DESC LIMIT 100
),
bayes_top AS (
  SELECT movie_id, n_ratings FROM movie_stats, g WHERE n_ratings > 0
  ORDER BY (n_ratings * avg_rating + 50 * global_avg) / (n_ratings + 50) DESC LIMIT 100
)
SELECT 'raw_avg' AS ranking, COUNT(*) FILTER (WHERE n_ratings < 50) AS under_50_in_top100 FROM raw_top
UNION ALL
SELECT 'bayes',  COUNT(*) FILTER (WHERE n_ratings < 50) FROM bayes_top;

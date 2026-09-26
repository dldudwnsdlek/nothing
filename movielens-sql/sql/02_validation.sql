-- [V1] 행 수
SELECT 'ratings' AS tbl, COUNT(*) AS n FROM ratings
UNION ALL SELECT 'movies', COUNT(*) FROM movies
UNION ALL SELECT 'users',  COUNT(*) FROM users;

-- [V2] 키 중복: 같은 사용자가 같은 영화를 두 번 평가했는가 / movie_id·user_id 중복
SELECT
  (SELECT COUNT(*) FROM (SELECT user_id, movie_id FROM ratings GROUP BY 1, 2 HAVING COUNT(*) > 1) d) AS dup_user_movie,
  (SELECT COUNT(*) - COUNT(DISTINCT movie_id) FROM movies) AS dup_movie_id,
  (SELECT COUNT(*) - COUNT(DISTINCT user_id)  FROM users)  AS dup_user_id;

-- [V3] 참조 무결성: movies/users 에 없는 id 를 가진 평점
SELECT
  (SELECT COUNT(*) FROM ratings r LEFT JOIN movies m ON r.movie_id = m.movie_id WHERE m.movie_id IS NULL) AS orphan_movie,
  (SELECT COUNT(*) FROM ratings r LEFT JOIN users  u ON r.user_id  = u.user_id  WHERE u.user_id  IS NULL) AS orphan_user;

-- [V4] 값 범위와 결측
SELECT MIN(rating) AS min_rating, MAX(rating) AS max_rating,
       COUNT(*) - COUNT(rating) AS null_rating,
       MIN(TO_TIMESTAMP(rated_at_unix)) AS first_rated, MAX(TO_TIMESTAMP(rated_at_unix)) AS last_rated
FROM ratings;

-- [V5] 평점이 하나도 없는 영화 (카탈로그에는 있지만 반응 데이터가 없는 아이템)
SELECT COUNT(*) AS movies_without_rating
FROM movies m
WHERE NOT EXISTS (SELECT 1 FROM ratings r WHERE r.movie_id = m.movie_id);

-- [V6] 조인 전후 건수 검증: 3개 테이블 JOIN 후에도 평점 수가 그대로인가
SELECT (SELECT COUNT(*) FROM ratings) AS before_join,
       (SELECT COUNT(*) FROM ratings r JOIN movies m USING (movie_id) JOIN users u USING (user_id)) AS after_join;

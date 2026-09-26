-- 영화 단위 집계 테이블 (평점 없는 영화도 포함하기 위해 LEFT JOIN)
DROP TABLE IF EXISTS movie_stats;
CREATE TABLE movie_stats AS
SELECT m.movie_id, m.title, m.genres,
       COUNT(r.rating)                 AS n_ratings,
       ROUND(AVG(r.rating)::NUMERIC, 3) AS avg_rating
FROM movies m
LEFT JOIN ratings r ON m.movie_id = r.movie_id
GROUP BY m.movie_id, m.title, m.genres;

-- 장르 정규화: 'Action|Comedy' → 1행 1장르 (다대다 관계 풀기)
DROP TABLE IF EXISTS movie_genres;
CREATE TABLE movie_genres AS
SELECT movie_id, UNNEST(STRING_TO_ARRAY(genres, '|')) AS genre
FROM movies;

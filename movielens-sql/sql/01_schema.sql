-- PostgreSQL 스키마. 적재는 psql 에서:
--   \copy movies  FROM 'data/csv/movies.csv'  CSV HEADER
--   \copy users   FROM 'data/csv/users.csv'   CSV HEADER
--   \copy ratings FROM 'data/csv/ratings.csv' CSV HEADER
-- (제약조건을 일부러 걸지 않고 적재한 뒤 02_validation.sql 로 먼저 검증)
DROP TABLE IF EXISTS ratings; DROP TABLE IF EXISTS movies; DROP TABLE IF EXISTS users;
CREATE TABLE movies  (movie_id INT, title TEXT, genres TEXT);
CREATE TABLE users   (user_id INT, gender TEXT, age INT, occupation INT, zip_code TEXT);
CREATE TABLE ratings (user_id INT, movie_id INT, rating INT, rated_at_unix BIGINT);

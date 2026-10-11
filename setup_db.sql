CREATE USER alpedo_user;
-- Después ejecutá `\password alpedo_user` en psql para asignar una clave privada.
CREATE DATABASE alpedo_db OWNER alpedo_user;
GRANT ALL PRIVILEGES ON DATABASE alpedo_db TO alpedo_user;

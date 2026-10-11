CREATE USER alpedo_user WITH PASSWORD 'AlPedoPy2026_SecPass!';
CREATE DATABASE alpedo_db OWNER alpedo_user;
GRANT ALL PRIVILEGES ON DATABASE alpedo_db TO alpedo_user;

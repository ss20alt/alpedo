# 🚀 Guía de Despliegue en Servidor: alpedo.app

Esta guía detalla los pasos para desplegar **alpedo.app** en un servidor privado (VPS en Oracle Cloud, DigitalOcean, Hetzner, AWS, Linode, etc.) utilizando **PostgreSQL**, **PM2** o **Docker**, junto con **Nginx** y certificado **SSL gratuito**.

---

## 📋 Requisitos Previos en el Servidor

1. **Sistema Operativo**: Ubuntu 22.04 LTS / 24.04 LTS o Debian 12.
2. **Node.js**: Versión 20.x o 22.x LTS.
3. **PostgreSQL**: Versión 15 o superior.
4. **PM2**: Administrador de procesos en segundo plano.
5. **Nginx o Caddy**: Servidor web y reverse proxy para SSL HTTPS.

---

## 🛠️ 1. Preparar el Servidor y Base de Datos

### Instalar PostgreSQL
```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
```

### Crear Base de Datos y Usuario
```bash
sudo -u postgres psql
```

Dentro de la consola de PostgreSQL:
```sql
CREATE DATABASE alpedo_db;
CREATE USER alpedo_user WITH ENCRYPTED PASSWORD 'TuPasswordSeguro2026!';
GRANT ALL PRIVILEGES ON DATABASE alpedo_db TO alpedo_user;
\c alpedo_db
GRANT ALL ON SCHEMA public TO alpedo_user;
\q
```

### Inicializar las Tablas
```bash
psql -U alpedo_user -d alpedo_db -h 127.0.0.1 -f init_schema.sql
```

---

## 📦 2. Despliegue con Node.js & PM2 (Método Nativo)

### 1. Clonar el repositorio
```bash
cd /home/ubuntu
git clone https://github.com/ss20alt/alpedo.git finanzas-inteligentes
cd finanzas-inteligentes
```

### 2. Configurar Variables de Entorno (`.env.local`)
```bash
cp .env.example .env.local
nano .env.local
```
Configura:
```env
DATABASE_URL=postgresql://alpedo_user:TuPasswordSeguro2026!@127.0.0.1:5432/alpedo_db
GEMINI_API_KEY=tu_api_key_de_gemini
NODE_ENV=production
```

### 3. Instalar Dependencias y Compilar
```bash
npm install
npm run build
```

### 4. Iniciar con PM2
```bash
npm install -g pm2
pm2 start "npx next start -H 0.0.0.0 -p 3001" --name "finanzas-paraguay"
pm2 save
pm2 startup
```

---

## 🐳 3. Despliegue Alternativo con Docker & Docker Compose

Si prefieres aislar todo en contenedores Docker:

```bash
# 1. Asegurar variables en docker-compose.yml o .env
# 2. Levantar los servicios:
docker compose up -d --build
```
La aplicación quedará escuchando en el puerto `3000`.

---

## 🔒 4. Configurar Dominio y HTTPS Gratuito con Nginx y Certbot

### 1. Configurar Nginx
Crea el archivo `/etc/nginx/sites-available/alpedo.conf`:

```nginx
server {
    server_name misfinanzas.tudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Habilita el sitio y reinicia Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/alpedo.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. Instalar Certificado SSL Let's Encrypt
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d misfinanzas.tudominio.com
```

---

## 💾 5. Copias de Seguridad de la Base de Datos

Para respaldar tu base de datos PostgreSQL automáticamente:
```bash
pg_dump -U alpedo_user -h 127.0.0.1 alpedo_db > backup_$(date +%F).sql
```
O desde la interfaz web en la pestaña **Ajustes**, descargando el respaldo completo en formato JSON.

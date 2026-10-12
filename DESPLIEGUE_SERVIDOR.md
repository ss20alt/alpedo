# Despliegue de alpedo.app

La aplicación usa PostgreSQL. El contenedor de Docker contiene solo Next.js; la base debe existir y tener respaldos propios.

## Preparación

1. Configurá una instancia PostgreSQL privada. `setup_db.sql` crea la cuenta sin contraseña; asigná una clave única con `\password alpedo_user` en `psql` antes de conectar la aplicación.
2. En una instalación nueva, ejecutá `migrate_users.sql` y luego `init_schema.sql` sobre la base creada. En una instalación existente, hacé primero un respaldo y revisá las migraciones antes de aplicarlas.
3. Definí `DATABASE_URL` en el entorno del proceso. Si el servicio corre en Docker y PostgreSQL corre en el host, usá `host.docker.internal` en la URL.
4. Configurá HTTPS en el proxy público y después definí `ENABLE_HTTPS=true`. El proxy debe redirigir HTTP a HTTPS; evitá publicar directamente el puerto de Next.js.
5. Configurá `GEMINI_API_KEY` solo si querés respuestas de IA. La evaluación numérica funciona sin esa clave.

Para actualizar una instalación existente con metas vinculadas y el ranking voluntario de rachas, respaldá PostgreSQL y aplicá antes de desplegar la app:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20261011_shared_couples_and_streak_leaderboard.sql
```

## Ejecución

```bash
npm ci
npm run build
npm start
```

O con Docker:

```bash
docker compose up -d --build
```

El archivo `.env.local` sirve para desarrollo local y nunca debe subirse al repositorio ni entrar en la imagen. `docker-compose.yml` recibe las variables del entorno del host.

## Seguridad temporal del VPS (HTTP mientras no haya dominio)

- Publicá Alpedo solo por Nginx en `:3001`. El proceso Next debe escuchar en `127.0.0.1:3002`; el puerto interno no se expone a Internet. En este servidor, `:80` también atiende otra aplicación y debe permanecer disponible.
- Permití en el firewall solo SSH `22`, HTTP de la otra aplicación `80` y el proxy Alpedo `3001`. Cerrá el acceso directo a `3000`, `3002`, `5432`, `8080` y `443`. PostgreSQL debe seguir ligado a localhost. Repetí las mismas reglas en el firewall del proveedor.
- En el VPS, respaldá y aplicá las reglas de host con `sudo bash ops/restrict-firewall.sh`; el script conserva el firewall IPv4 del proveedor, cierra los puertos internos y bloquea nuevas conexiones IPv6 hasta configurar ese acceso.
- Incluí `nginx_rate_limits.conf` dentro del contexto `http {}` de Nginx y usá `nginx_finanzas.conf` como servidor de Alpedo. Aplica un límite de ráfaga a `/api/` y reemplaza los encabezados de IP reenviados por el proxy.
- La app valida el origen de todas las escrituras `/api/*` y aplica límites por IP y cuenta. Los contadores se guardan como HMAC en `api_rate_limits`; no se persisten correos o direcciones IP en claro.
- Instalá `ops/alpedo-healthcheck.service` y `ops/alpedo-healthcheck.timer` en `/etc/systemd/system/`, ejecutá `systemctl daemon-reload` y habilitá el timer. Consultá fallos con `journalctl -u alpedo-healthcheck.service`. Instalá `ops/pm2-logrotate.conf` en `/etc/logrotate.d/pm2-ubuntu` para conservar hasta 14 días de logs PM2.
- **HTTPS queda para el último paso**, cuando el dominio esté comprado y apuntado. Hasta entonces la URL por IP funciona sobre HTTP; no uses datos sensibles ni reutilices credenciales importantes durante estas pruebas.

## Antes de abrir el servicio al público

- Rotá la contraseña de PostgreSQL que estuvo en el código publicado y actualizá `DATABASE_URL` en todos los procesos. Quitarla del código actual no elimina el historial de Git.
- Cambiá el PIN de cualquier cuenta de demostración existente. La instalación nueva ya no crea una cuenta ni movimientos de ejemplo.
- Probá registro, inicio/cierre de sesión, cambio de PIN, creación/edición/borrado de movimientos y restauración de un respaldo en una base de ensayo.
- Probá la eliminación permanente de cuenta en una base de ensayo siguiendo [docs/ELIMINACION_CUENTA.md](docs/ELIMINACION_CUENTA.md). No uses una cuenta real para esa prueba; la operación no se puede revertir.
- Hacé respaldo de PostgreSQL y ensayá la restauración. El JSON descargable complementa el respaldo de base de datos.
- Revisá las limitaciones de la versión antes de lanzar: las rachas cuentan días desde el último gasto registrado y el simulador de préstamos no incluye seguros ni comisiones. El ranking de rachas es voluntario: solo publica el apodo elegido y los días de racha.

El código de esta carpeta no actualiza automáticamente la publicación del VPS. Desplegá solo después de validar las variables, migraciones necesarias y rotación de credenciales. Configurá HTTPS cuando tengas el dominio listo.

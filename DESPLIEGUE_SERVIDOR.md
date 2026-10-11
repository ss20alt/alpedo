# Despliegue de alpedo.app

La aplicación usa PostgreSQL. El contenedor de Docker contiene solo Next.js; la base debe existir y tener respaldos propios.

## Preparación

1. Configurá una instancia PostgreSQL privada. `setup_db.sql` crea la cuenta sin contraseña; asigná una clave única con `\password alpedo_user` en `psql` antes de conectar la aplicación.
2. En una instalación nueva, ejecutá `migrate_users.sql` y luego `init_schema.sql` sobre la base creada. En una instalación existente, hacé primero un respaldo y revisá las migraciones antes de aplicarlas.
3. Definí `DATABASE_URL` en el entorno del proceso. Si el servicio corre en Docker y PostgreSQL corre en el host, usá `host.docker.internal` en la URL.
4. Configurá HTTPS en el proxy público y después definí `ENABLE_HTTPS=true`. El proxy debe redirigir HTTP a HTTPS; evitá publicar directamente el puerto de Next.js.
5. Configurá `GEMINI_API_KEY` solo si querés respuestas de IA. La evaluación numérica funciona sin esa clave.

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

## Antes de abrir el servicio al público

- Rotá la contraseña de PostgreSQL que estuvo en el código publicado y actualizá `DATABASE_URL` en todos los procesos. Quitarla del código actual no elimina el historial de Git.
- Cambiá el PIN de cualquier cuenta de demostración existente. La instalación nueva ya no crea una cuenta ni movimientos de ejemplo.
- Probá registro, inicio/cierre de sesión, cambio de PIN, creación/edición/borrado de movimientos y restauración de un respaldo en una base de ensayo.
- Hacé respaldo de PostgreSQL y ensayá la restauración. El JSON descargable complementa el respaldo de base de datos.
- Revisá las limitaciones de la versión antes de lanzar: las metas de pareja no sincronizan dos cuentas, las rachas cuentan días desde el último gasto registrado y el simulador de préstamos no incluye seguros ni comisiones.

El código de esta carpeta no actualiza automáticamente la publicación del VPS. Desplegá solo después de validar las variables, HTTPS, la migración y la rotación de credenciales.

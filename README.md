# alpedo.app

Aplicación de finanzas personales en guaraníes, diseñada principalmente para móvil. Usa Next.js 16 y PostgreSQL.

## Desarrollo local

1. Instalá dependencias con `npm ci`.
2. Creá `.env.local` a partir de `.env.example` y configurá `DATABASE_URL`. Mantené `ENABLE_HTTPS=false` para localhost.
3. Prepará PostgreSQL. En una base nueva ejecutá `migrate_users.sql` y luego `init_schema.sql`.
4. Ejecutá `npm run dev` y abrí `http://127.0.0.1:3000`.

El registro crea una cuenta vacía. Para volver a ingresar se requieren el correo y PIN; el correo se recuerda en el dispositivo para agilizar el acceso.

## Acceso y borradores móviles

En Ajustes, cada usuario puede generar un código de respaldo confirmando su PIN. El código se muestra una sola vez; hay que guardarlo fuera de la app. Si olvida el PIN, puede usar «Olvidé mi PIN» con su correo y ese código. Generar otro código o cambiar el PIN invalida el anterior.

Al cargar un movimiento nuevo, la app guarda un borrador por cuenta en este dispositivo. Si se corta la conexión mientras la app está abierta, permite guardarlo y enviarlo manualmente al volver a conectarse. El borrador no se sincroniza entre dispositivos y no sustituye un respaldo de datos.

## Verificación

```bash
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

Antes de publicar, seguí [la guía de despliegue](DESPLIEGUE_SERVIDOR.md). La configuración de HTTPS, rotación de credenciales y respaldo de PostgreSQL son pasos obligatorios de lanzamiento.

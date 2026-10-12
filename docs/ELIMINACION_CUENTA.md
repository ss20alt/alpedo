# Eliminación permanente de una cuenta

## Experiencia para la persona

La opción está en **Ajustes → Eliminar cuenta**. La app requiere tres confirmaciones: el correo exacto de la cuenta, el PIN actual (6–12 dígitos) y la frase `ELIMINAR MI CUENTA`. No hay un mecanismo para deshacer el borrado. La pantalla recomienda descargar un respaldo JSON antes de continuar.

El endpoint `DELETE /api/account` solo acepta una sesión autenticada y valida correo, frase y PIN. La verificación del PIN y el borrado ocurren dentro de una transacción PostgreSQL; si una operación falla, PostgreSQL revierte todo. La sesión actual se revoca al finalizar.

## Datos eliminados

- Perfil y credenciales de la cuenta.
- Todos sus movimientos, incluidos registros históricos sin propietario que solo la cuenta heredada `id = 1` puede consultar.
- Simulaciones de préstamos, reto de ahorro y rachas que administra.
- Participación voluntaria en el ranking, sesiones, código de recuperación y límite de intentos ligado a su correo.
- Metas de pareja que creó y todos los aportes de esas metas. La otra persona deja de ver esa meta.
- Códigos de amistad y claves de racha asociadas a la cuenta.
- Preferencias de cuenta que se duplican en la tabla global `settings` para la cuenta heredada `id = 1`.

Si la cuenta eliminada era colaboradora de una meta ajena, la meta se conserva, se quita el vínculo y el nombre de sus aportes pasa a **Cuenta eliminada**. Los importes aportados permanecen incluidos en el total de esa meta.

## Datos locales del dispositivo

Al terminar, el navegador actual borra las claves locales asociadas a esa cuenta (modo privado, guía, borradores de movimientos y notas offline) y el correo recordado si coincide. Las notas offline nuevas se vinculan al usuario para que no se compartan al cambiar de cuenta. Las notas antiguas que se guardaron antes de esta vinculación no tienen propietario identificable y pueden permanecer en el almacenamiento local; borrá los datos del sitio si querés quitarlas. El servidor tampoco puede borrar el almacenamiento de otros teléfonos o navegadores.

## Verificación antes de publicar

1. Iniciar la app local en `http://127.0.0.1:3002` y definir `ACCOUNT_DELETION_TEST_DATABASE_URL` con la cadena PostgreSQL de una base que escuche en localhost. Ejecutar `npm run test:account-deletion`; el script rechaza bases o servidores que no sean localhost y elimina las dos cuentas QA al terminar.
2. Comprobar que correo o frase incorrectos y PIN incorrecto no borren nada.
3. Borrar esa cuenta con el PIN correcto; verificar que ya no pueda iniciar sesión y que no queden filas privadas asociadas.
4. Crear una meta propiedad de otra cuenta, participar desde QA y verificar que al borrar QA la meta y su importe permanecen con el aporte anonimizado.
5. Comprobar que la eliminación no altera datos de otra cuenta ni `settings.app_name`.
6. Ejecutar `npm test`, `npm run lint`, `npx tsc --noEmit --incremental false` y `npm run build`.

No requiere migración de esquema: utiliza las tablas existentes y borra sus filas de forma transaccional. Aplicar un despliegue normal de la aplicación después de las verificaciones.

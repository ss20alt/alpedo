# 🚀 Guía de Despliegue en Servidor: Finanzas Inteligentes

Esta guía te explica cómo ejecutar la aplicación localmente en tu computadora y cómo subirla a cualquier servidor privado (VPS en DigitalOcean, Hetzner, Linode, AWS, VPS local, etc.) utilizando Docker.

---

## 💻 1. Probar la aplicación en tu computadora local

Podés correr el sistema de inmediato en tu máquina:

```powershell
# 1. Abrir terminal en la carpeta del proyecto
cd C:\Users\acer\.gemini\antigravity\scratch\finanzas-inteligentes

# 2. Iniciar en modo desarrollo
npm run dev
```

Abrí tu navegador en: **`http://localhost:3000`**

- La primera vez te pedirá crear tu **PIN Maestro** (mínimo 4 caracteres/números).
- Podés ir a la pestaña **Ajustes** y tocar **"Cargar Datos de Demostración"** para ver el semáforo y las métricas en acción de inmediato.

---

## 🐳 2. Despliegue en Servidor con Docker (Recomendado)

Esta es la forma más limpia y portátil de alojarlo en tu servidor. Toda la base de datos queda guardada en la carpeta `./data` de tu servidor.

### Requisitos en el servidor:
- Tener instalado **Docker** y **Docker Compose**.

### Pasos:

1. **Subir los archivos a tu servidor:**
   Podés clonar el repositorio o copiar la carpeta del proyecto a tu servidor (por ejemplo, a `/opt/finanzas-inteligentes`):
   ```bash
   scp -r finanzas-inteligentes usuario@tu-servidor-ip:/opt/
   ```

2. **Ingresar a la carpeta en tu servidor:**
   ```bash
   cd /opt/finanzas-inteligentes
   ```

3. **(Opcional) Editar variables en `docker-compose.yml`:**
   Podés cambiar `SESSION_SECRET` por cualquier frase larga aleatoria para proteger las cookies de sesión.

4. **Levantar el contenedor:**
   ```bash
   docker compose up -d --build
   ```

5. ¡Listo! La aplicación ya está corriendo en el puerto `3000` de tu servidor (`http://tu-servidor-ip:3000`).

---

## 🔒 3. Conectar Dominio y Certificado SSL (HTTPS Gratuito)

Para que puedas entrar desde tu celular de forma segura (`https://mis-finanzas.tudominio.com`), podés usar **Caddy** (la opción más fácil) o **Nginx**.

### Opción A: Con Caddy (Configuración en 3 líneas con SSL automático)
Instalá Caddy en tu servidor y creá el archivo `/etc/caddy/Caddyfile`:

```caddyfile
mis-finanzas.tudominio.com {
    reverse_proxy localhost:3000
}
```

Reiniciá Caddy (`sudo systemctl restart caddy`) y ya tendrás HTTPS con certificado Let's Encrypt automático.

### Opción B: Cloudflare Tunnels (Zero Trust - No requiere abrir puertos)
Si tenés tu dominio en Cloudflare, podés instalar `cloudflared` en tu servidor y apuntar el túnel a `http://localhost:3000`. No necesitás abrir puertos en el firewall ni configurar IP pública fija.

---

## 💾 4. Copias de Seguridad (Backups)

Tenés 2 formas súper fáciles de respaldar tu información:

1. **Desde la Interfaz Web:**
   Andá a la pestaña **Ajustes & Respaldo** y hacé clic en **"Descargar Copia de Seguridad Completa (JSON)"**. Podés guardarlo en tu compu o celular y restaurarlo cuando quieras con un solo clic.

2. **Copiando el archivo SQLite:**
   Todos tus datos están en un solo archivo: `./data/finanzas.db`.
   Hacer un backup es tan simple como copiar ese archivo:
   ```bash
   cp /opt/finanzas-inteligentes/data/finanzas.db /backups/finanzas_$(date +%F).db
   ```

<div align="center">

# 🧉 alpedo.app — Finanzas Inteligentes Paraguay

**El gestor de finanzas personales pensado para la realidad paraguaya.**  
Controlá tus gastos hormiga ("al pedo"), medí tu ritmo de gasto mensual, simulá compras con IA y compartí metas de ahorro.

[![Next.js](https://img.shields.io/badge/Next.js-16.4.0-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3.0-20232A?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-AI-8E75B2?style=for-the-badge&logo=google)](https://aistudio.google.com/)

[Características](#-características-principales) •
[Stack Tecnológico](#-stack-tecnológico) •
[Inicio Rápido](#-inicio-rápido-en-local) •
[Base de Datos](#-base-de-datos) •
[Despliegue](#-despliegue-en-producción) •
[Estructura](#-estructura-del-código)

---

</div>

## 📌 ¿Por qué alpedo.app?

La mayoría de las apps de finanzas son frías, complejas y diseñadas para economías en dólares.  
**alpedo.app** está adaptada a la cultura financiera de **Paraguay (Guaraníes ₲)**:
- 💡 Clasifica los gastos en lo que realmente importa: **Fijos**, **Variables**, **Pasivos** y los famosos gastos **"¡Al Pedo!"**.
- ⚡ Permite registrar consumos diarios en **1 segundo** sin fricción.
- 🧉 Cuenta con **"El Kape"**, un asesor financiero impulsado por **Google Gemini AI** que te dice las cosas claras y en tono paraguayo.

---

## ✨ Características Principales

### 🚦 1. Tablero y Semáforo de Ritmo de Gasto
- **Monitoreo en Tiempo Real**: Compara el porcentaje de días transcurridos en el mes vs. el presupuesto consumido.
- **Alertas Inteligentes**: Te avisa si vas a ritmo *Controlado 🟢*, *Atento 🟡* o *Acelerado 🔴* antes de llegar a fin de mes.
- **Salud Financiera & Superávit**: Métricas claras sobre ahorro mensual y fondo de emergencia.

### ⚡ 2. Carga Rápida en 1-Toque
- Accesos directos preconfigurados con montos típicos paraguayos:
  - 🚗 **Bolt** (₲ 25.000)
  - 🏪 **Biggie** (₲ 45.000)
  - 🍔 **Lomito** (₲ 30.000)
  - ☕ **Café** (₲ 15.000)
  - ⛽ **Nafta** (₲ 100.000)
- Registro directo como gasto "Al Pedo" con un solo clic.

### 🧉 3. Inteligencia Artificial Financiera
- **"El Kape" (Chatbot Financiero)**: Asesor con contexto financiero paraguayo impulsado por la API de Google Gemini.
- **¿Me da el cuero? 🤔**: Modal interactivo donde ingresas lo que quieres comprar y tu salario/presupuesto actual. La IA analiza el impacto en tus números y te da un veredicto honesto.

### 👫 4. Finanzas en Pareja
- Creación de **Metas Compartidas** (Viajes, Hogar, Compras).
- Código de vinculación único para sincronizar aportes entre dos usuarios.
- Registro de aportes individuales con historial transparente.

### 🔥 5. Gamificación: Reto 1% y Rachas
- **Reto de Ahorro del 1%**: Metodología progresiva mes a mes para construir patrimonio sin sacrificios extremos.
- **Rachas con Amigos & Desafíos**: Mantené viva la racha de días consecutivos sin exceder tu límite "al pedo".

### 📊 6. Estadísticas y Agrupación por Comercio
- Gráficos tipo dona con desglose de categorías.
- Detección automática y agrupación de gastos por negocio o comercio (*Superseis, Biggie, Petrobras, etc.*).
- Exportación completa de movimientos a formato CSV / Excel.

### 🔒 7. Privacidad y Seguridad
- **PIN Maestro**: Bloqueo con hash seguro.
- **Modo Privacidad (Ojo 👁️)**: Oculta los saldos y montos en pantalla con un solo toque para cuando estás en lugares públicos.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
| :--- | :--- |
| **Frontend** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) con [React 19](https://react.dev/) |
| **Estilos** | [Tailwind CSS v4](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/) |
| **Lenguaje** | [TypeScript](https://www.typescriptlang.org/) |
| **Backend & APIs** | Next.js API Routes (Serverless / Node.js) |
| **Base de Datos** | [PostgreSQL](https://www.postgresql.org/) (y soporte SQLite de respaldo) |
| **Inteligencia Artificial** | [Google Gemini 2.0 / 1.5](https://aistudio.google.com/) |

---

## 🚀 Inicio Rápido en Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/ss20alt/alpedo.git
cd alpedo
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env.local` en la raíz del proyecto basándote en `.env.example`:

```env
# Conexión a PostgreSQL
DATABASE_URL=postgresql://alpedo_user:tu_contraseña@127.0.0.1:5432/alpedo_db

# Google Gemini API Key (Gratis en https://aistudio.google.com/)
GEMINI_API_KEY=tu_api_key_de_gemini_aqui

# Entorno
NODE_ENV=development
```

### 4. Inicializar la Base de Datos
Si estás usando PostgreSQL, ejecuta el script de inicialización:
```bash
psql -U alpedo_user -d alpedo_db -f init_schema.sql
```

### 5. Iniciar el servidor de desarrollo
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 🗄️ Base de Datos

El esquema principal de **PostgreSQL** (`init_schema.sql`) incluye las siguientes tablas:

- `users`: Cuentas, balances base, banco, límites de presupuesto y hash del PIN.
- `transactions`: Ingresos y egresos clasificados (`fijo`, `variable`, `pasivo`, `al_pedo`), fecha, comercio y usuario.
- `settings`: Parámetros globales de la aplicación y preferencias de moneda.
- `couples_goals` & `couples_contributions`: Metas colaborativas y aportes en pareja.
- `savings_challenge`: Progreso del Reto 1%.
- `friend_streaks`: Contador de días en racha de control de gastos.
- `loan_simulations`: Simulaciones guardadas de préstamos y cuotas.

---

## 🐳 Despliegue en Producción

### Opción A: Docker & Docker Compose (Recomendado)
El proyecto incluye `Dockerfile` optimizado y `docker-compose.yml`:

```bash
# Construir y levantar contenedor
docker compose up -d --build
```
La aplicación quedará corriendo automáticamente en el puerto `3000`.

### Opción B: Despliegue en Servidor VPS con PM2
1. Compilar el proyecto en el servidor:
   ```bash
   npm run build
   ```
2. Iniciar con PM2:
   ```bash
   pm2 start "npx next start -H 0.0.0.0 -p 3001" --name "finanzas-paraguay"
   pm2 save
   ```
3. Configurar Nginx o Caddy como Proxy Inverso con SSL Let's Encrypt (ver detalles en [`DESPLIEGUE_SERVIDOR.md`](DESPLIEGUE_SERVIDOR.md)).

---

## 📂 Estructura del Código

```plaintext
├── public/                 # Íconos PWA, logos y manifiesto
├── src/
│   ├── app/
│   │   ├── api/            # Endpoints REST (auth, transactions, ai, couples, streaks, etc.)
│   │   ├── globals.css     # Estilos globales y tokens Tailwind
│   │   ├── layout.tsx      # Layout raíz con metadatos PWA
│   │   └── page.tsx        # Dashboard interactivo principal
│   ├── components/         # Componentes modulares de interfaz
│   │   ├── BudgetTrackerCard.tsx   # Semáforo de ritmo mensual
│   │   ├── CouplesTab.tsx          # Gestión en pareja
│   │   ├── CueroModal.tsx          # Modal "¿Me da el cuero?" (IA)
│   │   ├── CopilotDashboard.tsx    # Asistente Kape
│   │   ├── LoanSimulator.tsx       # Simulador de préstamos
│   │   ├── StreaksTab.tsx          # Pestaña de rachas
│   │   └── ...
│   └── lib/
│       ├── auth.ts                 # Lógica de sesión y PIN
│       ├── db.ts                   # Conector PostgreSQL pool
│       ├── finance-engine.ts       # Cálculos matemáticos y métricas
│       └── haptics.ts              # Vibración táctil para móviles
├── init_schema.sql         # Esquema DDL completo para PostgreSQL
├── docker-compose.yml      # Configuración de contenedores Docker
└── DESPLIEGUE_SERVIDOR.md  # Guía paso a paso de servidores
```

---

## 📄 Licencia

Este proyecto está distribuido bajo la licencia **MIT**. Puedes usarlo, modificarlo y desplegarlo libremente.

---

<div align="center">
Hecho con ☕ y 🧉 para mejorar la salud financiera en Paraguay.
</div>

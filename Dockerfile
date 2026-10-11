# Etapa 1: Dependencias
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package*.json ./
RUN npm install

# Etapa 2: Compilación
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Etapa 3: Producción Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN apk add --no-cache libc6-compat

# Copiar archivos compilados y dependencias necesarias
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Directorio de persistencia para SQLite
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["npm", "start"]

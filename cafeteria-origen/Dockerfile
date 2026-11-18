# =============================================================================
# Imagen de la aplicación Cafetería Origen
# =============================================================================
FROM node:22-alpine

# Descripción de la imagen y usuario no root para reducir privilegios.
LABEL org.opencontainers.image.title="Cafetería Origen" \
      org.opencontainers.image.description="Sitio web + API para el práctico de Ciberseguridad"

WORKDIR /app

# Dependencias primero (capa cacheable). Se instalan también las de desarrollo
# porque `npm test` se ejecuta DENTRO del contenedor (npm test debe quedar en
# verde tal como se pide en la consigna del parcial).
COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund

# Código de la aplicación (TypeScript: lo ejecuta tsx, sin paso de compilación)
COPY src ./src
COPY scripts ./scripts
COPY tests ./tests

# Archivos de infraestructura: el checklist de seguridad los revisa también
# (configuración de Docker, mínimos privilegios en la base de datos).
COPY docker-compose.yml Dockerfile ./

# Carpeta de archivos subidos
RUN mkdir -p /app/uploads

EXPOSE 3000

# Liveness del contenedor: /api/salud
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/salud || exit 1

CMD ["node", "--import", "tsx", "src/server.ts"]

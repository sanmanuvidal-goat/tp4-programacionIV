FROM node:22-alpine

LABEL org.opencontainers.image.title="Cafetería Origen" \
      org.opencontainers.image.description="Sitio web + API para el práctico de Ciberseguridad"

WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund

COPY src ./src
COPY scripts ./scripts
COPY tests ./tests
COPY docker-compose.yml Dockerfile ./

# Creamos carpeta de subidas y asignamos propiedad al usuario sin privilegios 'node'
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/salud || exit 1

CMD ["node", "--import", "tsx", "src/server.ts"]
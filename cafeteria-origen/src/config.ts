import path from 'path';
import crypto from 'crypto';

function requerirEnv(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno obligatoria: ${nombre}`);
  }
  return valor;
}

export default {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || 'db',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'origen',
    user: requerirEnv('DB_USER'),
    password: requerirEnv('DB_PASSWORD'),
  },

  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),

  credencialesPorDefecto: {
    username: process.env.DEFAULT_ADMIN_USER || 'admin_origen',
    password: process.env.DEFAULT_ADMIN_PASS || crypto.randomBytes(16).toString('hex'),
  },

  uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads'),
};
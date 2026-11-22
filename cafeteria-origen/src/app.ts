import path from 'path';
import express from 'express';

import config from './config';
import { rutaNoEncontrada, manejadorErrores } from './middleware/errores';
import authRoutes from './routes/auth.routes';
import productosRoutes from './routes/productos.routes';
import pedidosRoutes from './routes/pedidos.routes';
import reportesRoutes from './routes/reportes.routes';
import comentariosRoutes from './routes/comentarios.routes';
import adminRoutes from './routes/admin.routes';
import debugRoutes from './routes/debug.routes';
import helmet from 'helmet';
import crypto from 'crypto';
import { obtenerSesion, obtenerOCrearTokenCsrf } from './middleware/sesion';
const METODOS_MUTANTES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const app = express();

function origenPermitido(req: express.Request): boolean {
  const host = req.get('host');
  const candidato = req.get('origin') || req.get('referer');

  if (!candidato) {
    return true;
  }

  try {
    const parsed = new URL(candidato);
    return Boolean(host && parsed.host === host);
  } catch {
    return false;
  }
}
app.get('/api/csrf-token', (req, res) => {
  const csrfToken = obtenerOCrearTokenCsrf(req, res);
  res.json({ csrfToken });
});

app.use('/api', (req, res, next) => {
  if (!METODOS_MUTANTES.has(req.method.toUpperCase())) {
    return next();
  }

  if (req.path === '/auth/login') {
    return next();
  }

  if (!origenPermitido(req)) {
    res.status(403).json({ error: 'Origen no permitido (CSRF)' });
    return;
  }

  const sesion = obtenerSesion(req);
  const tokenEsperado = sesion?.csrfToken;
  const headerToken = req.get('x-csrf-token');
  const bodyToken =
    typeof req.body?._csrf === 'string' ? req.body._csrf : undefined;
  const tokenRecibido = headerToken || bodyToken;

  if (!tokenEsperado || !tokenRecibido) {
    res.status(403).json({ error: 'Token CSRF faltante o inválido' });
    return;
  }

  const bufEsperado = Buffer.from(tokenEsperado, 'utf8');
  const bufRecibido = Buffer.from(tokenRecibido, 'utf8');

  if (
    bufEsperado.length !== bufRecibido.length ||
    !crypto.timingSafeEqual(bufEsperado, bufRecibido)
  ) {
    res.status(403).json({ error: 'Token CSRF inválido' });
    return;
  }

  next();
});


/**
 * FALLA — Ajustes de configuración (OWASP A05:2021)
 *
 * Faltan:
 *  - helmet (cabeceras de seguridad: CSP, X-Content-Type-Options, HSTS...)
 *  - límite de tamaño del cuerpo más estricto por ruta
 *  - rate limiting global
 *  - política de CORS restringida al propio origen
 *  - helmet CSP además sirve como capa extra frente al XSS
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        imgSrc: ["'self'", 'data:'],
        frameAncestors: ["'self'"],
      },
    },
    frameguard: { action: 'sameorigin' },
    referrerPolicy: { policy: 'no-referrer' },
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Archivos subidos por el panel de administración.
app.use('/uploads', express.static(config.uploadsDir));

// Sitio web estático
app.use(express.static(path.join(__dirname, 'public')));

// --- API --------------------------------------------------------------------
app.get('/api/salud', (req, res) => {
  res.json({ ok: true, servicio: 'cafeteria-origen', hora: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/comentarios', comentariosRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/_diagnostico', debugRoutes);

app.use('/api', rutaNoEncontrada);

app.use(manejadorErrores);

export default app;

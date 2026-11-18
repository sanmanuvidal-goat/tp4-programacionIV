import express from 'express';

const router = express.Router();

/**
 * Endpoint de diagnóstico.
 *
 * -----------------------------------------------------------------------------
 * FALLA — Exposición de información sensible (OWASP A01:2021 / A05:2021)
 * -----------------------------------------------------------------------------
 * Devuelve el contenido completo de `process.env`: credenciales de la base de
 * datos, secretos, configuración interna... y NO requiere autenticación.
 *
 * En un entorno real estos endpoints quedan detrás de autenticación y no
 * deberían existir en producción.
 */
router.get('/', (req, res) => {
  res.json({
    mensaje: 'Diagnóstico del servidor',
    version: '1.0.0',
    entorno: process.env,
    baseDeDatos: {
      host: process.env.DB_HOST,
      puerto: process.env.DB_PORT,
      nombre: process.env.DB_NAME,
      usuario: process.env.DB_USER,
      // FALLA: también se filtra la contraseña.
      password: process.env.DB_PASSWORD,
    },
    sistema: {
      node: process.version,
      plataforma: process.platform,
      arquitectura: process.arch,
      memoria: process.memoryUsage(),
      uptime: process.uptime(),
      pid: process.pid,
    },
  });
});

export default router;

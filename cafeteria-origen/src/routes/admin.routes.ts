import express from 'express';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

import config from '../config';
import * as catalogo from '../services/catalogo.service';
import * as usuarios from '../services/usuarios.service';
import { requiereSesion, requiereRol } from '../middleware/auth';
import type { Usuario } from '../tipos';

const router = express.Router();

router.use(requiereSesion);
router.use(requiereRol('admin'));

/** GET /api/admin/usuarios */
router.get('/usuarios', async (req, res, next) => {
  try {
    res.json({ usuarios: await usuarios.listar() });
  } catch (err) {
    next(err);
  }
});

const ROLES_VALIDOS = ['admin', 'barista', 'mozo', 'cliente'];

/** PUT /api/admin/usuarios/:id */
router.put('/usuarios/:id', async (req, res, next) => {
  try {
    if (!req.usuario || req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'No tenés permisos para esta operación.' });
    }

    const { username, nombre, rol, password } = req.body || {};
    const cambios: Partial<Usuario> = {};
    if (username !== undefined) cambios.username = username;
    if (nombre !== undefined) cambios.nombre = nombre;
    if (rol !== undefined) {
      if (!ROLES_VALIDOS.includes(rol)) {
        return res.status(400).json({ error: 'Rol inválido.' });
      }
      cambios.rol = rol;
    }
    if (password !== undefined) cambios.password = password;

    const usuario = await usuarios.actualizar(req.params.id, cambios);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    res.json(usuario);
  } catch (err) {
    next(err);
  }
});

/** POST /api/admin/productos — alta de producto. */
router.post('/productos', async (req, res, next) => {
  try {
    const producto = await catalogo.crear(req.body || {});
    res.status(201).json(producto);
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'Ya existe un producto con ese nombre.' });
    }
    next(err);
  }
});

/** PUT /api/admin/productos/:id */
router.put('/productos/:id', async (req, res, next) => {
  try {
    const producto = await catalogo.actualizar(req.params.id, req.body || {});
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json(producto);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/admin/productos/:id */
router.delete('/productos/:id', async (req, res, next) => {
  try {
    const producto = await catalogo.eliminar(req.params.id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json(producto);
  } catch (err) {
    next(err);
  }
});

/** POST /api/admin/cambiar-contrasena */
router.post('/cambiar-contrasena', async (req, res, next) => {
  try {
    const { nueva } = req.body || {};
    if (!nueva) {
      return res.status(400).json({ error: 'Falta la contraseña nueva.' });
    }
    const usuario = await usuarios.cambiarPassword(req.usuario!.id, nueva);
    res.json({ mensaje: 'Contraseña actualizada.', usuario });
  } catch (err) {
    next(err);
  }
});

const HOSTS_PERMITIDOS = new Set([
  'localhost',
  '127.0.0.1',
  'db',
  'api.cafeteriaorigen.local',
]);
const HOST_REGEX = /^[a-zA-Z0-9.-]{1,253}$/;

/** POST /api/admin/probar-conexion */
router.post('/probar-conexion', (req, res) => {
  const { host } = req.body || {};

  if (
    typeof host !== 'string' ||
    !HOST_REGEX.test(host) ||
    host.startsWith('-') ||
    !HOSTS_PERMITIDOS.has(host)
  ) {
    return res.status(400).json({ error: 'Host no permitido o inválido.' });
  }

  const child = spawn('ping', ['-c', '3', host], { shell: false });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('error', (error) => {
    res.status(500).json({
      comando: `ping -c 3 ${host}`,
      salida: stdout,
      error: error.message,
    });
  });

  child.on('close', (code) => {
    res.json({
      comando: `ping -c 3 ${host}`,
      salida: stdout,
      error: code !== 0 ? stderr || `Código de salida ${code}` : null,
    });
  });
});

/** POST /api/admin/subir-archivo */
router.post('/subir-archivo', express.json({ limit: '8mb' }), (req, res, next) => {
  try {
    const { nombre, contenidoBase64 } = req.body || {};

    if (!nombre || !contenidoBase64) {
      return res.status(400).json({ error: 'Falta el archivo.' });
    }

    const buffer = Buffer.from(contenidoBase64, 'base64');
    fs.mkdirSync(config.uploadsDir, { recursive: true });

    const destino = path.join(config.uploadsDir, nombre);
    fs.writeFileSync(destino, buffer);

    res.json({
      mensaje: 'Archivo subido.',
      url: `/uploads/${nombre}`,
      bytes: buffer.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
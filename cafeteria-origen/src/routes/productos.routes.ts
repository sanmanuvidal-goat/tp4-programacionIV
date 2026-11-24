import express from 'express';
import * as catalogo from '../services/catalogo.service';
import type { FiltrosCatalogo } from '../services/catalogo.service';

const router = express.Router();

/**
 * GET /api/productos?tipo=&variedad=&q=
 * Lista el catálogo con filtros opcionales.
 *
 * FALLA — Inyección SQL: los filtros llegan concatenados al texto SQL
 * (ver services/catalogo.service.ts).
 *
 * FALLA — XSS reflejado: la respuesta incluye los filtros que mandó el
 * cliente y el sitio web los pinta con innerHTML. Un `<script>` en `q` se
 * ejecuta en el navegador de quien hizo la búsqueda.
 */
router.get('/', async (req, res, next) => {
  try {
    const productos = await catalogo.listar(req.query as FiltrosCatalogo);
    res.json({
      productos,
      // Se devuelve el eco de los filtros: es el vector del XSS reflejado.
      filtros: {
        tipo: req.query.tipo || '',
        variedad: req.query.variedad || '',
        q: req.query.q || '',
      },
      total: productos.length,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/productos/variedades */
router.get('/variedades', async (req, res, next) => {
  try {
    res.json({ variedades: await catalogo.variedades() });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/productos/:id
 * Devuelve un producto.
 *
 * FALLA — Inyección SQL en el id (el id se mete en la consulta entre comillas).
 * FALLA — XSS reflejado: el mensaje de error incluye el id recibido.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID de producto inválido.' });
    }

    const producto = await catalogo.obtener(id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json(producto);
  } catch (err) {
    next(err);
  }
});

export default router;

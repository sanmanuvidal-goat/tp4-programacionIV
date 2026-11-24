import express from 'express';
import * as pedidos from '../services/pedidos.service';
import { validarTexto, validarEnteroEnRango, validarId } from '../validacion';

const router = express.Router();
const ESTADOS_PERMITIDOS = new Set(['abierto', 'preparando', 'listo', 'entregado', 'cancelado']);

/** POST /api/pedidos */
router.post('/', async (req, res, next) => {
  try {
    const { mesa, cliente, items } = req.body || {};

    const mesaValida = validarTexto(mesa, 1, 30);
    if (!mesaValida) {
      return res.status(400).json({ error: 'Mesa inválida.' });
    }

    const clienteValido = validarTexto(cliente, 1, 100);
    if (!clienteValido) {
      return res.status(400).json({ error: 'Nombre de cliente inválido.' });
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({ error: 'El pedido debe incluir entre 1 y 50 ítems.' });
    }

    const itemsValidados: { productoId: number; cantidad: number }[] = [];
    for (const item of items) {
      if (!item || typeof item !== 'object') {
        return res.status(400).json({ error: 'Formato de ítem inválido.' });
      }
      const productoId = validarId(item.productoId);
      const cantidad = validarEnteroEnRango(item.cantidad, 1, 100);
      if (!productoId || cantidad === null) {
        return res.status(400).json({ error: 'Cada ítem debe tener un productoId y una cantidad entera entre 1 y 100.' });
      }
      itemsValidados.push({ productoId, cantidad });
    }

    const pedido = await pedidos.crear({
      mesa: mesaValida,
      cliente: clienteValido,
      items: itemsValidados,
    });

    if (!pedido) {
      return res.status(404).json({ error: 'Uno o más productos no existen.' });
    }

    res.status(201).json(pedido);
  } catch (err) {
    next(err);
  }
});

/** GET /api/pedidos?mesa= */
router.get('/', async (req, res, next) => {
  try {
    const mesa = typeof req.query.mesa === 'string' ? req.query.mesa.trim().slice(0, 30) : undefined;
    res.json({ pedidos: await pedidos.listar(mesa) });
  } catch (err) {
    next(err);
  }
});

/** GET /api/pedidos/:id */
router.get('/:id', async (req, res, next) => {
  try {
    const id = validarId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de pedido inválido.' });
    }

    const pedido = await pedidos.obtenerConItems(id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    res.json(pedido);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/pedidos/:id/estado */
router.patch('/:id/estado', async (req, res, next) => {
  try {
    const id = validarId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de pedido inválido.' });
    }

    const { estado } = req.body || {};
    if (typeof estado !== 'string' || !ESTADOS_PERMITIDOS.has(estado)) {
      return res.status(400).json({ error: 'Estado de pedido inválido.' });
    }

    const pedido = await pedidos.cambiarEstado(id, estado);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    res.json(pedido);
  } catch (err) {
    next(err);
  }
});

export default router;
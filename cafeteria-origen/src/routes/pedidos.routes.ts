import express from 'express';
import * as pedidos from '../services/pedidos.service';

const router = express.Router();

/**
 * POST /api/pedidos
 * Crea un pedido y devuelve su total calculado.
 *
 * FALLAS:
 *  - CSRF: no hay token anti-CSRF ni verificación de Origin/Referer, y la
 *    cookie de sesión no tiene SameSite. Una página externa puede POSTear
 *    con las cookies de la víctima.
 *  - Validación de entrada débil: no se valida tipo, rango ni longitud de
 *    `cantidad`, `mesa`, `cliente` ni de la lista de items.
 *  - No requiere autenticación ni rol.
 */
router.post('/', async (req, res, next) => {
  try {
    const { mesa, cliente, items } = req.body || {};
    const pedido = await pedidos.crear({ mesa, cliente, items });
    res.status(201).json(pedido);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/pedidos?mesa=
 * Lista los pedidos de todas las mesas.
 *
 * FALLA — Inyección SQL en el filtro de mesa.
 * FALLA — Autorización: cualquier visitante puede ver los pedidos de TODAS
 * las mesas (los datos de los clientes de los demás).
 */
router.get('/', async (req, res, next) => {
  try {
    res.json({ pedidos: await pedidos.listar(req.query.mesa as string | undefined) });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/pedidos/:id
 * FALLA — IDOR: no se verifica que el pedido pertenezca al usuario que pregunta.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const pedido = await pedidos.obtenerConItems(req.params.id);
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
    const { estado } = req.body || {};
    // FALLA: no se valida el valor de `estado` (cualquier texto se acepta)
    // ni se comprueba el rol del que modifica el pedido.
    const pedido = await pedidos.cambiarEstado(req.params.id, estado);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    res.json(pedido);
  } catch (err) {
    next(err);
  }
});

export default router;

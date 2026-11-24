import * as db from '../db';
import { calcularPrecio } from '../catalogo';
import type { Pedido, PedidoConItems, PedidoItem, Producto } from '../tipos';

export interface ItemPedido {
  productoId: number;
  cantidad: number;
}

export interface NuevoPedido {
  mesa: string;
  cliente: string;
  items: ItemPedido[];
}

type Id = number | string;

export async function crear({ mesa, cliente, items }: NuevoPedido): Promise<PedidoConItems | null> {
  const filas: { productoId: number; cantidad: number; precioUnitario: number }[] = [];

  for (const item of items) {
    const producto = await buscarProducto(item.productoId);
      if (!producto) return null;
    const precioUnitario = calcularPrecio(producto);
    filas.push({
      productoId: producto.id,
      cantidad: item.cantidad,
      precioUnitario,
    });
  }

  const total = filas.reduce(
    (acc, f) => acc + f.precioUnitario * f.cantidad,
    0
  );

  const { rows } = await db.query<Pedido>(
    `INSERT INTO pedidos (mesa, cliente, estado, total)
     VALUES ($1, $2, 'abierto', $3)
     RETURNING *`,
    [mesa, cliente, total]
  );
  const pedido = rows[0];

  for (const fila of filas) {
    await db.query(
      `INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario)
       VALUES ($1, $2, $3, $4)`,
      [pedido.id, fila.productoId, fila.cantidad, fila.precioUnitario]
    );
  }

  return obtenerConItems(pedido.id);
}

async function buscarProducto(productoId: number): Promise<Producto> {
  const { rows } = await db.query<Producto>('SELECT * FROM productos WHERE id = $1', [productoId]);
  return rows[0];
}

export async function listar(mesa?: string): Promise<Pedido[]> {
  if (mesa) {
    const { rows } = await db.query<Pedido>(
      'SELECT * FROM pedidos WHERE mesa = $1 ORDER BY id DESC',
      [mesa]
    );
    return rows;
  }

  const { rows } = await db.query<Pedido>('SELECT * FROM pedidos ORDER BY id DESC');
  return rows;
}

export async function obtenerConItems(id: Id): Promise<PedidoConItems | null> {
  const { rows: pedidos } = await db.query<Pedido>(
    'SELECT * FROM pedidos WHERE id = $1',
    [id]
  );
  const pedido = pedidos[0];
  if (!pedido) return null;

  const { rows: items } = await db.query<PedidoItem>(
    `SELECT pi.*, pr.nombre AS producto_nombre
       FROM pedido_items pi
       JOIN productos pr ON pr.id = pi.producto_id
      WHERE pi.pedido_id = $1`,
    [id]
  );

  return { ...pedido, items };
}

export async function cambiarEstado(id: Id, estado: string): Promise<Pedido | null> {
  const { rows } = await db.query<Pedido>(
    'UPDATE pedidos SET estado = $1 WHERE id = $2 RETURNING *',
    [estado, id]
  );
  return rows[0] || null;
}
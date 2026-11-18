import * as db from '../db';
import { calcularPrecio } from '../catalogo';
import type { DatosProducto, Producto, ProductoConPrecio } from '../tipos';

export interface FiltrosCatalogo {
  tipo?: string;
  variedad?: string;
  q?: string;
}

export type DatosProductoEntrada = Partial<DatosProducto> & { activo?: boolean };

type Id = number | string;

export async function listar(filtros: FiltrosCatalogo = {}): Promise<ProductoConPrecio[]> {
  const { tipo, variedad, q } = filtros;

  const condiciones: string[] = ['activo = true'];
  const params: unknown[] = [];

  if (tipo) {
    params.push(tipo);
    condiciones.push(`tipo = $${params.length}`);
  }
  if (variedad) {
    params.push(variedad);
    condiciones.push(`variedad = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    condiciones.push(`(nombre ILIKE $${params.length} OR descripcion ILIKE $${params.length})`);
  }

  const sql = `SELECT * FROM productos WHERE ${condiciones.join(' AND ')} ORDER BY tipo, variedad NULLS FIRST, id`;
  const { rows } = await db.query<Producto>(sql, params);

  return rows.map((p) => ({ ...p, precio: calcularPrecio(p) }));
}

export async function obtener(id: Id): Promise<ProductoConPrecio | null> {
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    return null;
  }

  const { rows } = await db.query<Producto>('SELECT * FROM productos WHERE id = $1', [idNum]);
  if (!rows[0]) return null;
  return { ...rows[0], precio: calcularPrecio(rows[0]) };
}

export async function crear(datos: DatosProductoEntrada): Promise<Producto> {
  const { rows } = await db.query<Producto>(
    `INSERT INTO productos (nombre, tipo, variedad, tamano, gramos, precio_base, precio_por_gramo, descripcion)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      datos.nombre,
      datos.tipo,
      datos.variedad || null,
      datos.tamano || null,
      datos.gramos ?? null,
      datos.precio_base ?? 0,
      datos.precio_por_gramo ?? 0,
      datos.descripcion || '',
    ]
  );
  return rows[0];
}

export async function actualizar(id: Id, datos: DatosProductoEntrada): Promise<Producto | null> {
  const { rows } = await db.query<Producto>(
    `UPDATE productos
        SET nombre = $1, tipo = $2, variedad = $3, tamano = $4, gramos = $5,
            precio_base = $6, precio_por_gramo = $7, descripcion = $8, activo = $9
      WHERE id = $10
      RETURNING *`,
    [
      datos.nombre,
      datos.tipo,
      datos.variedad || null,
      datos.tamano || null,
      datos.gramos ?? null,
      datos.precio_base ?? 0,
      datos.precio_por_gramo ?? 0,
      datos.descripcion || '',
      datos.activo !== false,
      id,
    ]
  );
  return rows[0] || null;
}

export async function eliminar(id: Id): Promise<Producto | null> {
  const { rows } = await db.query<Producto>(
    'UPDATE productos SET activo = false WHERE id = $1 RETURNING *',
    [id]
  );
  return rows[0] || null;
}

export async function variedades(): Promise<string[]> {
  const { rows } = await db.query<{ variedad: string }>(
    'SELECT DISTINCT variedad FROM productos WHERE variedad IS NOT NULL ORDER BY variedad'
  );
  return rows.map((r) => r.variedad);
}
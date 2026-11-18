/**
 * Catálogo de la Cafetería Origen.
 *
 * Tabla de precios tomada de la consigna del parcial:
 *   Expreso  -> precioBase 2500   |  Pocillo 18g · Mediano 27g · Taza grande 36g
 *   Filtrado -> precioBase 3200   |  Pocillo  6g · Mediano 15g · Taza grande 25g
 *   Pastelería -> Muffin 2500 · Torta selva negra 4200
 *
 * Precio por gramo: Brasil 140 · Colombia 180 · Etiopía 240
 * Precio final de un café = gramos x precioPorGramo + precioBase
 */

import type { DatosProducto, Numerico, TipoProducto, Variedad } from './tipos';

interface Tamano {
  tamano: string;
  gramos: number;
}

export const PRECIO_POR_GRAMO: Record<Variedad, number> = {
  Brasil: 140,
  Colombia: 180,
  'Etiopía': 240,
};

export const NOTAS_ORIGEN: Record<Variedad, string> = {
  Brasil: 'Acidez baja, cuerpo denso, notas de avellana.',
  Colombia: 'Acidez media, cuerpo equilibrado, notas cítricas y florales.',
  'Etiopía': 'Acidez muy viva, cuerpo ligero, notas frutales.',
};

const TAMANOS_EXPRESO: Tamano[] = [
  { tamano: 'Pocillo', gramos: 18 },
  { tamano: 'Mediano', gramos: 27 },
  { tamano: 'Taza grande', gramos: 36 },
];

const TAMANOS_FILTRADO: Tamano[] = [
  { tamano: 'Pocillo', gramos: 6 },
  { tamano: 'Mediano', gramos: 15 },
  { tamano: 'Taza grande', gramos: 25 },
];

function construirCatalogo(): DatosProducto[] {
  const productos: DatosProducto[] = [];

  const cafes: [TipoProducto, number, Tamano[]][] = [
    ['espresso', 2500, TAMANOS_EXPRESO],
    ['filtrado', 3200, TAMANOS_FILTRADO],
  ];

  for (const [tipo, base, tamanos] of cafes) {
    for (const variedad of Object.keys(PRECIO_POR_GRAMO) as Variedad[]) {
      for (const t of tamanos) {
        const precioPorGramo = PRECIO_POR_GRAMO[variedad];
        const nombre = `${tipo === 'espresso' ? 'Espresso' : 'Filtrado'} ${t.tamano} ${variedad}`;
        productos.push({
          nombre,
          tipo,
          variedad,
          tamano: t.tamano,
          gramos: t.gramos,
          precio_base: base,
          precio_por_gramo: precioPorGramo,
          descripcion: `${t.gramos} g de café ${variedad}. ${NOTAS_ORIGEN[variedad]}`,
        });
      }
    }
  }

  productos.push({
    nombre: 'Muffin de chocolate',
    tipo: 'pasteleria',
    variedad: null,
    tamano: null,
    gramos: null,
    precio_base: 2500,
    precio_por_gramo: 0,
    descripcion: 'Muffin recién horneado con chips de chocolate.',
  });

  productos.push({
    nombre: 'Porción de torta selva negra',
    tipo: 'pasteleria',
    variedad: null,
    tamano: null,
    gramos: null,
    precio_base: 4200,
    precio_por_gramo: 0,
    descripcion: 'Porción de torta selva negra con crema y cereza.',
  });

  return productos;
}

/**
 * Calcula el precio final de un producto.
 * Regla: costo del café (gramos x precio por gramo) + precio base.
 */
export function calcularPrecio(producto: {
  gramos: number | null;
  precio_por_gramo: Numerico;
  precio_base: Numerico;
}): number {
  const gramos = Number(producto.gramos || 0);
  const precioPorGramo = Number(producto.precio_por_gramo || 0);
  const precioBase = Number(producto.precio_base || 0);
  return gramos * precioPorGramo + precioBase;
}

export const CATALOGO = construirCatalogo();

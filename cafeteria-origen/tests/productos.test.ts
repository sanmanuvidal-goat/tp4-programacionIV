import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { agente, prepararBase, productoPorNombre } from './helpers';
import type { ProductoConPrecio } from '../src/tipos';

describe('Catálogo de productos', () => {
  before(async () => {
    await prepararBase();
  });

  test('GET /api/productos devuelve el catálogo completo', async () => {
    const res = await agente().get('/api/productos');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.productos));
    assert.equal(res.body.productos.length, 20, 'el catálogo tiene 20 productos');
  });

  test('el catálogo incluye café de los tres orígenes y pastelería', async () => {
    const res = await agente().get('/api/productos');
    const nombres = res.body.productos.map((p: ProductoConPrecio) => p.nombre);

    assert.ok(nombres.includes('Espresso Pocillo Colombia'));
    assert.ok(nombres.includes('Filtrado Taza grande Etiopía'));
    assert.ok(nombres.includes('Muffin de chocolate'));
    assert.ok(nombres.includes('Porción de torta selva negra'));
  });

  test('GET /api/productos?tipo=espresso devuelve los 9 espressos', async () => {
    const res = await agente().get('/api/productos?tipo=espresso');
    assert.equal(res.status, 200);
    assert.equal(res.body.productos.length, 9);
    assert.ok(res.body.productos.every((p: ProductoConPrecio) => p.tipo === 'espresso'));
  });

  test('GET /api/productos?tipo=pasteleria devuelve 2 productos', async () => {
    const res = await agente().get('/api/productos?tipo=pasteleria');
    assert.equal(res.status, 200);
    assert.equal(res.body.productos.length, 2);
  });

  test('GET /api/productos?variedad=Colombia filtra por origen', async () => {
    const res = await agente().get('/api/productos?variedad=Colombia');
    assert.equal(res.status, 200);
    assert.equal(res.body.productos.length, 6, '3 tamaños de espresso + 3 de filtrado');
    assert.ok(res.body.productos.every((p: ProductoConPrecio) => p.variedad === 'Colombia'));
  });

  test('el precio final se calcula como costo del café + precio base', async () => {
    const res = await agente().get('/api/productos');
    const producto = res.body.productos.find((p: ProductoConPrecio) => p.nombre === 'Espresso Pocillo Brasil');

    // 18 g x $140 + $2500 de precio base
    assert.equal(Number(producto.precio), 5020);
  });

  test('los precios del parcial se respetan en todo el catálogo', async () => {
    const res = await agente().get('/api/productos');
    const porNombre: Record<string, number> = {};
    res.body.productos.forEach((p: ProductoConPrecio) => { porNombre[p.nombre] = Number(p.precio); });

    assert.equal(porNombre['Espresso Pocillo Brasil'], 5020);
    assert.equal(porNombre['Espresso Taza grande Etiopía'], 11140);
    assert.equal(porNombre['Filtrado Pocillo Brasil'], 4040);
    assert.equal(porNombre['Filtrado Taza grande Etiopía'], 9200);
    assert.equal(porNombre['Muffin de chocolate'], 2500);
    assert.equal(porNombre['Porción de torta selva negra'], 4200);
  });

  test('GET /api/productos/:id devuelve un producto', async () => {
    const brasil = await productoPorNombre('Espresso Pocillo Brasil');

    const res = await agente().get(`/api/productos/${brasil.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, brasil.id);
    assert.equal(res.body.tipo, 'espresso');
  });

  test('GET /api/productos/:id inexistente devuelve 404', async () => {
    const res = await agente().get('/api/productos/99999');
    assert.equal(res.status, 404);
  });
});

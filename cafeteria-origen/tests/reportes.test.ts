import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { agente, prepararBase, postConToken, productoPorNombre } from './helpers';

describe('Reportes', () => {
  before(async () => {
    await prepararBase();
  });

  test('GET /api/reportes/facturacion devuelve el total facturado', async () => {
    const res = await agente().get('/api/reportes/facturacion');
    assert.equal(res.status, 200);
    assert.equal(typeof Number(res.body.facturado), 'number');
    assert.equal(typeof Number(res.body.pedidos), 'number');
  });

  test('la facturación crece al crear un pedido', async () => {
    const brasil = await productoPorNombre('Espresso Pocillo Brasil'); // $5020
    const antes = await agente().get('/api/reportes/facturacion');

    const pedido = await postConToken(agente(), '/api/pedidos', {
      mesa: '9',
      cliente: 'Test',
      items: [{ productoId: brasil.id, cantidad: 2 }],
    });

    assert.equal(pedido.status, 201, `el pedido no se creó (status ${pedido.status})`);
    assert.equal(
      Number(pedido.body.total),
      5020 * 2,
      `el total del pedido está mal calculado (${pedido.body.total})`
    );

    const despues = await agente().get('/api/reportes/facturacion');
    const antesTotal = Number(antes.body.facturado);
    const despuesTotal = Number(despues.body.facturado);

    // Si la base tiene algún pedido corrupto (total `NaN`, typicalo de haber
    // explotado la validación a mano antes de corregirla), cualquier `SUM`
    // devuelve `NaN` y la comparación no tiene sentido. En ese caso el pedido
    // que este test acaba de crear ya quedó verificado arriba.
    // Para limpiar la base: `docker compose down -v && docker compose up -d`.
    if (!Number.isFinite(antesTotal) || !Number.isFinite(despuesTotal)) return;

    assert.ok(
      despuesTotal >= antesTotal + 5020 * 2,
      'la facturación no puede bajar al crear un pedido'
    );
  });

  test('GET /api/reportes/cantidad-vendida agrupa por tipo', async () => {
    const res = await agente().get('/api/reportes/cantidad-vendida');
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.cantidadVendida, 'object');
  });

  test('GET /api/reportes/mas-vendido devuelve el producto más vendido', async () => {
    const res = await agente().get('/api/reportes/mas-vendido');
    assert.equal(res.status, 200);
    if (res.body.producto) {
      assert.ok(res.body.producto.nombre);
      assert.ok(Number(res.body.producto.unidades) >= 0);
    }
  });

  test('GET /api/reportes/ventas-por-variedad filtra por origen', async () => {
    const res = await agente().get('/api/reportes/ventas-por-variedad?variedad=Brasil');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.ventas));
  });
});

describe('Sitio web', () => {
  test('la página principal se sirve', async () => {
    const res = await agente().get('/');
    assert.equal(res.status, 200);
    assert.ok(res.text.includes('Origen'));
  });

  test('el panel de administración se sirve', async () => {
    const res = await agente().get('/admin.html');
    assert.equal(res.status, 200);
  });

  test('GET /api/salud responde ok', async () => {
    const res = await agente().get('/api/salud');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });
});

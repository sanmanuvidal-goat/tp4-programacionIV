import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { agente, prepararBase, postConToken, patchConToken, productoPorNombre } from './helpers';

describe('Pedidos', () => {
  before(async () => {
    await prepararBase();
  });

  test('POST /api/pedidos calcula el total del pedido', async () => {
    const espresso = await productoPorNombre('Espresso Pocillo Colombia'); // $5740
    const muffin = await productoPorNombre('Muffin de chocolate'); // $2500

    const res = await postConToken(agente(), '/api/pedidos', {
      mesa: '3',
      cliente: 'Ana',
      items: [
        { productoId: espresso.id, cantidad: 2 },
        { productoId: muffin.id, cantidad: 1 },
      ],
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.mesa, '3');
    assert.equal(res.body.cliente, 'Ana');
    assert.equal(res.body.estado, 'abierto');
    // 5740 x 2 + 2500 x 1 = 13980
    assert.equal(Number(res.body.total), 13980);
    assert.equal(res.body.items.length, 2);
  });

  test('el total es la suma de calcularPrecio() por cantidad', async () => {
    const filtrado = await productoPorNombre('Filtrado Taza grande Brasil'); // $6700

    const res = await postConToken(agente(), '/api/pedidos', {
      mesa: '1',
      cliente: 'Beto',
      items: [{ productoId: filtrado.id, cantidad: 3 }],
    });

    assert.equal(res.status, 201);
    assert.equal(Number(res.body.total), 6700 * 3);
  });

  test('GET /api/pedidos lista los pedidos de todas las mesas', async () => {
    const res = await agente().get('/api/pedidos');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.pedidos));
    assert.ok(res.body.pedidos.length >= 2);
  });

  test('GET /api/pedidos/:id devuelve el pedido con sus items', async () => {
    const etiopia = await productoPorNombre('Espresso Taza grande Etiopía'); // $11140

    const creado = await postConToken(agente(), '/api/pedidos', {
      mesa: '7',
      cliente: 'Caro',
      items: [{ productoId: etiopia.id, cantidad: 1 }],
    });

    const res = await agente().get(`/api/pedidos/${creado.body.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.cliente, 'Caro');
    assert.equal(res.body.items.length, 1);
    assert.equal(Number(res.body.total), 11140);
  });

  test('el estado de un pedido se puede actualizar', async () => {
    const colombia = await productoPorNombre('Espresso Pocillo Colombia');

    const creado = await postConToken(agente(), '/api/pedidos', {
      mesa: '2',
      cliente: 'Dani',
      items: [{ productoId: colombia.id, cantidad: 1 }],
    });

    const res = await patchConToken(agente(), `/api/pedidos/${creado.body.id}/estado`, {
      estado: 'preparando',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'preparando');
  });
});

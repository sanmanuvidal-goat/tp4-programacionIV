import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  agente,
  prepararBase,
  login,
  crearUsuarioDePrueba,
  postConToken,
} from './helpers';

/**
 * Tests de autenticación.
 *
 * NO dependen de las contraseñas de la carga inicial: cada usuario de prueba
 * se crea con una contraseña conocida. Así el grupo puede cambiar (o
 * strengthen) las credenciales de ejemplo sin romper la suite.
 */

describe('Autenticación', () => {
  before(async () => {
    await prepararBase();
  });

  test('el login con credenciales válidas devuelve la sesión', async () => {
    await crearUsuarioDePrueba('func_admin', 'Clave_Funcional_2024!', 'admin');
    const res = await login(agente(), 'func_admin', 'Clave_Funcional_2024!');

    assert.equal(res.status, 200);
    assert.equal(res.body.usuario.username, 'func_admin');
    assert.equal(res.body.usuario.rol, 'admin');
  });

  test('GET /api/auth/yo devuelve el usuario de la sesión', async () => {
    await crearUsuarioDePrueba('func_barista', 'Clave_Funcional_2024!', 'barista');

    const http = agente();
    await login(http, 'func_barista', 'Clave_Funcional_2024!');

    const res = await http.get('/api/auth/yo');
    assert.equal(res.status, 200);
    assert.equal(res.body.usuario.username, 'func_barista');
    assert.equal(res.body.usuario.rol, 'barista');
  });

  test('un password incorrecto es rechazado', async () => {
    await crearUsuarioDePrueba('func_mal', 'Clave_Funcional_2024!', 'barista');
    const res = await login(agente(), 'func_mal', 'contraseña-equivocada');
    assert.equal(res.status, 401);
  });

  test('un usuario inexistente es rechazado', async () => {
    const res = await login(agente(), 'usuario-fantasma', 'loquesea');
    assert.equal(res.status, 401);
  });

  test('sin sesión, /api/auth/yo responde 401', async () => {
    const res = await agente().get('/api/auth/yo');
    assert.equal(res.status, 401);
  });

  test('el logout responde 200', async () => {
    await crearUsuarioDePrueba('func_logout', 'Clave_Funcional_2024!', 'mozo');

    const http = agente();
    await login(http, 'func_logout', 'Clave_Funcional_2024!');

    const res = await postConToken(http, '/api/auth/logout', {});
    assert.equal(res.status, 200);
  });
});

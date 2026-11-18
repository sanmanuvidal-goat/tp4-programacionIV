/**
 * =============================================================================
 * BATERÍA DE TESTS DE SEGURIDAD — login (archivo aislado)
 * =============================================================================
 *
 * Estos tests provocan LOGINS FALLIDOS a propósito (para intentar el bypass
 * por SQL y para comparar los mensajes de error). Por eso van en su propio
 * archivo: el rate limiting cuenta los intentos fallidos y, si compartieran
 * proceso con el resto de la suite, el bloqueo terminaría impediendo los
 * logins de los demás tests y los resultados serían inconsistentes.
 *
 * node --test ejecuta cada archivo en un proceso separado, así que este
 * archivo tiene su propio estado de rate limiting.
 * =============================================================================
 */

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import {
  app,
  agente,
  prepararBase,
  login,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
} from './helpers';

describe('Seguridad · Login', () => {
  before(async () => {
    await prepararBase();
  });

  after(async () => {
    // Borra los usuarios de prueba para no dejar basura en la base.
    await limpiarDatosDePrueba();
  });

  test('los mensajes de login son genéricos (sin enumeración de usuarios)', async () => {
    await crearUsuarioDePrueba('sec_enum', 'Sec_Clave_2024!', 'barista');

    const inexistente = await request(app)
      .post('/api/auth/login')
      .send({ username: 'usuario-que-no-existe-xyz', password: 'x' });
    const contraseñaIncorrecta = await request(app)
      .post('/api/auth/login')
      .send({ username: 'sec_enum', password: 'contraseña-equivocada' });

    assert.equal(
      inexistente.body.error,
      contraseñaIncorrecta.body.error,
      `Los mensajes distinguen entre "usuario inexistente" (${inexistente.body.error}) y ` +
        `"contraseña incorrecta" (${contraseñaIncorrecta.body.error}): permite enumerar usuarios.`
    );
  });

  test('el login NO acepta el bypass con payload SQL', async () => {
    const http = agente();
    const res = await login(http, "' OR 1=1 --", 'cualquiera');

    assert.notEqual(
      res.status,
      200,
      'El login devolvió 200 con el payload "\' OR 1=1 --": la inyección SQL del login sigue abierta (servicios/usuarios.service.ts).'
    );

    const yo = await http.get('/api/auth/yo');
    assert.notEqual(yo.status, 200, 'Quedó una sesión abierta tras un login inyectado.');
  });

  test('el login NO acepta el payload que comenta la contraseña', async () => {
    const res = await login(agente(), "admin'--", 'cualquiera');
    assert.notEqual(res.status, 200, 'El login aceptó "admin\'--" sin contraseña válida.');
  });
});

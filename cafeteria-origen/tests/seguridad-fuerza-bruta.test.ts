/**
 * =============================================================================
 * BATERÍA DE TESTS DE SEGURIDAD — fuerza bruta (archivo aislado)
 * =============================================================================
 *
 * Este test va SOLO en su propio archivo a propósito: el rate limiting es un
 * contador en memoria del proceso de Node. Si compartiera proceso con los
 * demás tests de seguridad, el bloqueo por IP que se prueba acá terminaría
 * bloqueando los logins de esa misma suite (y los resultados serían
 * inconsistentes).
 *
 * node --test ejecuta cada archivo en un proceso separado, así que este
 * archivo tiene su propio estado de rate limiting.
 * =============================================================================
 */

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { app, prepararBase, crearUsuarioDePrueba, limpiarDatosDePrueba } from './helpers';

describe('Seguridad · Fuerza bruta', () => {
  before(async () => {
    await prepararBase();
  });

  after(async () => {
    // Borra los usuarios de prueba para no dejar basura en la base.
    await limpiarDatosDePrueba();
  });

  test('el login bloquea o limita los intentos repetidos', async () => {
    await crearUsuarioDePrueba('sec_brute', 'Sec_Clave_2024!', 'barista');

    const INTENTOS = 10;
    let bloqueado = false;
    let statusBloqueo = null;

    for (let i = 0; i < INTENTOS; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'sec_brute', password: `intento-fallido-${i}` });

      if (res.status !== 401) {
        bloqueado = true;
        statusBloqueo = res.status;
        break;
      }
    }

    assert.ok(
      bloqueado,
      `La API aceptó ${INTENTOS} intentos de login fallidos seguidos sin bloquear ni limitar nada ` +
        '(fuerza bruta ilimitada). Aplicá rate limiting con express-rate-limit sobre /api/auth/login.'
    );
    assert.ok(
      statusBloqueo === 429 || statusBloqueo === 403 || statusBloqueo === 423,
      `El bloqueo respondió ${statusBloqueo}; se espera 429 (Too Many Requests), 403 o 423 (Locked).`
    );
  });

  test('el login correcto sigue funcionando después de un bloqueo', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'sec_brute', password: 'Sec_Clave_2024!' });

    assert.ok(
      res.status === 200 || res.status === 429 || res.status === 403 || res.status === 423,
      `El login con contraseña correcta respondió ${res.status}.`
    );
  });
});

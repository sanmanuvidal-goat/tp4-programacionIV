/**
 * =============================================================================
 * BATERÍA DE TESTS DE SEGURIDAD — Cafetería Origen
 * =============================================================================
 *
 * A diferencia de `tests/*.test.ts` (que son FUNCIONALES y siempre están en
 * verde), esta batería comprueba que **las fallas de seguridad estén
 * efectivamente corregidas**: hace la petición maliciosa y verifica que ya
 * NO tiene efecto.
 *
 * Estado inicial (versión vulnerable): ✘ falla
 * Estado final (versión corregida):   ✔ pasa
 *
 *   docker compose exec app npm run test:seguridad
 *
 * IMPORTANTE — Alcance ethicalo:
 * Todos los payloads de esta archivo se ejecutan contra la instalación LOCAL
 * del proyecto (localhost / la base de datos del propio contenedor). No
 * apuntan a ningún sistema externo ni se automatiza ningún ataque contra
 * terceros. El objetivo es verificar la DEFENSA, no la explotación.
 *
 * La batería de fuerza bruta va en un archivo aparte
 * (`seguridad-fuerza-bruta.test.ts`) porque el rate limiting es un contador
 * en memoria: si compartiera proceso con los demás tests, bloquearía los
 * logins de esta misma suite.
 * =============================================================================
 */

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import fs from 'fs';
import path from 'path';

import * as db from '../src/db';
import {
  app,
  agente,
  prepararBase,
  login,
  productoPorNombre,
  crearUsuarioDePrueba,
  cookieCruda,
  MARCA_PRUEBA,
  limpiarDatosDePrueba,
} from './helpers';
import type { Pedido, PedidoItem, ProductoConPrecio } from '../src/tipos';

/** Cuerpo JSON de una petición. */
type Cuerpo = Record<string, unknown>;

/** Cualquier cliente HTTP que sepa hacer un GET (agente o `conSesion`). */
interface ClienteGet {
  get(url: string): PromiseLike<request.Response>;
}

interface InfoCsrf {
  token: string;
  cookies: string;
}

/**
 * Limpia los datos que dejaron corridas anteriores de la batería.
 *
 * Importa: sobre la versión vulnerable, la batería crea pedidos con total
 * negativo y con total `NaN` (el `NaN` envenena cualquier `SUM` de la base y
 * hace fallar los tests funcionales de facturación). La batería tiene que
 * dejar la base como la encontró.
 */
before(async () => {
  await limpiarDatosDePrueba();
});

/* ------------------------------- utilidades ------------------------------ */

/**
 * Construye una cabecera Cookie con todas las cookies de una respuesta.
 * Sirve para el patrón double-submit del token anti-CSRF: la cookie `csrf`
 * tiene que viajar junto con el token.
 */
function cookiesDe(res: request.Response): string {
  const setCookie = (res.headers['set-cookie'] as unknown as string[] | undefined) || [];
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

/** Une dos cabeceras Cookie sin repetir cookies. */
function unirCookies(a?: string, b?: string): string {
  const partes = `${a || ''}; ${b || ''}`.split(';').map((s) => s.trim()).filter(Boolean);
  const vistas = new Set<string>();
  const unicas: string[] = [];
  for (const p of partes) {
    const nombre = p.split('=')[0];
    if (vistas.has(nombre)) continue;
    vistas.add(nombre);
    unicas.push(p);
  }
  return unicas.join('; ');
}

/**
 * Busca el token anti-CSRF en las rutas habituales o en un input hidden.
 * Devuelve { token, cookies } o null.
 */
async function obtenerTokenCsrf(http: ClienteGet): Promise<InfoCsrf | null> {
  const rutas = ['/api/csrf-token', '/api/auth/csrf-token', '/api/auth/csrf', '/api/csrf'];
  for (const ruta of rutas) {
    try {
      const res = await http.get(ruta);
      if (res.status === 200 && res.body) {
        const token = res.body.token || res.body.csrfToken;
        if (token) return { token, cookies: cookiesDe(res) };
      }
    } catch (err) { /* esa ruta no existe */ }
  }
  for (const pagina of ['/', '/admin.html']) {
    try {
      const res = await http.get(pagina);
      const m = /name="_csrf"\s+value="([^"]+)"/.exec(res.text || '');
      if (m) return { token: m[1], cookies: '' };
    } catch (err) { /* sin formularios renderizados en el server */ }
  }
  return null;
}

/** Extrae el valor de la cookie `sid` de una cabecera Set-Cookie cruda. */
function valorSid(cookie: string): string | null {
  const m = /sid=([^;]+)/.exec(cookie || '');
  return m ? m[1] : null;
}

/**
 * Inicia sesión y devuelve las cookies de la respuesta.
 *
 * Se mandan las cookies a mano en vez de usar un agente porque las cookies
 * con la bandera `Secure` no se guardan sobre HTTP: con el agente, la sesión
 * se perdería y los tests medirían la cosa equivocada.
 */
async function autenticar(username: string, password: string) {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return { res, cookies: cookiesDe(res), sid: valorSid(cookieCruda(res)) };
}

/** Cliente HTTP que manda las cookies de sesión en cada petición. */
function conSesion(cookies: string) {
  const cabeceras = { Cookie: cookies || '' };
  return {
    get: (url: string) => request(app).get(url).set(cabeceras),
    post: (url: string, cuerpo?: Cuerpo) => request(app).post(url).set(cabeceras).send(cuerpo || {}),
    put: (url: string, cuerpo?: Cuerpo) => request(app).put(url).set(cabeceras).send(cuerpo || {}),
    patch: (url: string, cuerpo?: Cuerpo) => request(app).patch(url).set(cabeceras).send(cuerpo || {}),
    delete: (url: string) => request(app).delete(url).set(cabeceras),
  };
}

/** Texto completo de una respuesta JSON (para buscar filtraciones). */
function cuerpo(res: request.Response): string {
  return JSON.stringify(res.body || {});
}

/* ============================ 1. SQL INJECTION ============================ */

describe('Seguridad · Inyección SQL', () => {
  before(async () => {
    await prepararBase();
  });

  test('la búsqueda del catálogo NO se puede ampliar con SQL', async () => {
    const payload = "' or '1'='1";
    const res = await agente().get(`/api/productos?q=${encodeURIComponent(payload)}`);
    const productos: ProductoConPrecio[] = res.body.productos || [];

    const escaparon = productos.filter(
      (p) => !`${p.nombre} ${p.descripcion}`.toLowerCase().includes(payload)
    );
    assert.equal(
      escaparon.length,
      0,
      `La búsqueda devolvió ${productos.length} productos (${escaparon.length} que no contienen el texto buscado): el payload sigue inyectando SQL en el catálogo.`
    );
  });

  test('el filtro por origen NO se puede ampliar con SQL', async () => {
    const res = await agente().get(
      `/api/productos?variedad=${encodeURIComponent("Colombia' OR '1'='1")}`
    );
    const productos: ProductoConPrecio[] = res.body.productos || [];

    const fueraDeColombia = productos.filter((p) => p.variedad !== 'Colombia');
    assert.equal(
      fueraDeColombia.length,
      0,
      `El filtro por origen devolvió ${productos.length} productos (${fueraDeColombia.length} de otros orígenes): el payload sigue inyectando SQL.`
    );
  });

  test('el filtro por mesa NO se puede ampliar con SQL', async () => {
    const res = await agente().get(
      `/api/pedidos?mesa=${encodeURIComponent("' OR '1'='1")}`
    );
    const pedidos: Pedido[] = res.body.pedidos || [];

    const otrasMesas = pedidos.filter((p) => !String(p.mesa).includes("' OR '1'='1"));
    assert.equal(
      otrasMesas.length,
      0,
      `El filtro por mesa devolvió ${pedidos.length} pedidos de otras mesas: el payload sigue inyectando SQL.`
    );
  });

  test('el reporte por origen NO filtra otras tablas con UNION', async () => {
    const res = await agente().get(
      `/api/reportes/ventas-por-variedad?variedad=${encodeURIComponent(
        "Brasil' UNION SELECT username, password, 1, 1 FROM usuarios--"
      )}`
    );

    const { rows: usuarios } = await db.query('SELECT username, password FROM usuarios');
    const texto = cuerpo(res);
    const filtradas = usuarios.filter(
      (u) => u.password && u.password.length >= 6 && texto.includes(u.password)
    );

    assert.equal(
      filtradas.length,
      0,
      `El reporte devolvió datos de la tabla usuarios mediante UNION (${filtradas
        .map((u) => u.username)
        .join(', ')}): la inyección SQL del reporte sigue abierta.`
    );
  });

  test('la aplicación NO se conecta con un superusuario de la base', async () => {
    const { rows } = await db.query(
      `SELECT current_user AS usuario,
              (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS es_superusuario`
    );
    assert.equal(
      rows[0].es_superusuario,
      false,
      `La aplicación se conecta como "${rows[0].usuario}", que es superusuario: usá el usuario origen_app con permisos reducidos (mínimos privilegios).`
    );
  });
});

/* ================================ 2. XSS ================================ */

describe('Seguridad · Cross-Site Scripting', () => {
  before(async () => {
    await prepararBase();
  });

  test('el servidor NO devuelve HTML sin escapar en los errores', async () => {
    const payload = '<script>alert(1)</script>';
    const res = await agente().get(`/api/productos/${encodeURIComponent(payload)}`);
    const texto = cuerpo(res);

    assert.ok(
      !/<script/i.test(texto),
      `La respuesta del servidor devuelve el HTML recibido tal cual: ${texto}`
    );
  });

  test('el login NO devuelve HTML sin escapar en el mensaje de error', async () => {
    const res = await login(agente(), '<img src=x onerror=alert(1)>', 'x');
    const texto = cuerpo(res);

    assert.ok(
      !/<img/i.test(texto),
      `El mensaje de error del login devuelve HTML sin escapar: ${texto}`
    );
  });

  test('el cliente NO inserta datos con innerHTML', () => {
    const dir = path.join(__dirname, '..', 'src', 'public', 'js');
    const archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));

    const conInnerHtml = [];
    for (const archivo of archivos) {
      const contenido = fs.readFileSync(path.join(dir, archivo), 'utf8');
      // Si el grupo usa una librería sanitizadora (DOMPurify), se acepta.
      if (/DOMPurify/i.test(contenido)) continue;
      if (/\.innerHTML\s*=/.test(contenido)) {
        conInnerHtml.push(`src/public/js/${archivo}`);
      }
    }

    assert.deepEqual(
      conInnerHtml,
      [],
      `Estos archivos siguen inyectando con innerHTML: ${conInnerHtml.join(', ')}. Usá textContent o document.createElement.`
    );
  });
});

/* =============================== 3. CSRF =============================== */

describe('Seguridad · CSRF', () => {
  before(async () => {
    await prepararBase();
  });

  after(async () => {
    await limpiarDatosDePrueba();
  });

  test('existe un token anti-CSRF y las peticiones sin token se rechazan', async () => {
    await crearUsuarioDePrueba('sec_csrf', 'Sec_Clave_2024!', 'admin');
    const { res: loginRes, cookies } = await autenticar('sec_csrf', 'Sec_Clave_2024!');
    assert.equal(loginRes.status, 200, 'No se pudo iniciar sesión con el usuario de prueba.');

    const info = await obtenerTokenCsrf(conSesion(cookies));
    assert.ok(
      info && info.token,
      'No se encontró ningún token anti-CSRF. La app debe generar un token aleatorio por sesión, ' +
        'exponerlo (por ejemplo GET /api/csrf-token) y validarlo en el servidor.'
    );

    const producto = await productoPorNombre('Espresso Pocillo Brasil');
    const cuerpoPedido = {
      mesa: '1',
      cliente: MARCA_PRUEBA,
      items: [{ productoId: producto.id, cantidad: 1 }],
    };

    // Sin token: tiene que ser rechazado.
    const sinToken = await conSesion(cookies).post('/api/pedidos', cuerpoPedido);
    assert.ok(
      sinToken.status >= 400,
      `La API aceptó un POST sin token anti-CSRF (status ${sinToken.status}).`
    );

    // Con token: tiene que funcionar.
    const conToken = await conSesion(unirCookies(cookies, info.cookies))
      .post('/api/pedidos', Object.assign({}, cuerpoPedido, { _csrf: info.token }))
      .set('X-CSRF-Token', info.token);
    assert.ok(
      conToken.status < 500,
      `La API devolvió ${conToken.status} al enviar el token: revisá la verificación.`
    );
  });
});

/* ========================== 4. VALIDACIÓN ========================== */

describe('Seguridad · Validación de entrada', () => {
  before(async () => {
    await prepararBase();
  });

  after(async () => {
    // Los pedidos y la reseña que crean estos tests se borran: sobre la
    // versión vulnerable quedan con total negativo o `NaN` y romperían la
    // facturación de los tests funcionales.
    await limpiarDatosDePrueba();
  });

  test('no se aceptan cantidades negativas', async () => {
    const producto = await productoPorNombre('Espresso Pocillo Colombia');
    const res = await agente().post('/api/pedidos').send({
      mesa: '1',
      cliente: MARCA_PRUEBA,
      items: [{ productoId: producto.id, cantidad: -5 }],
    });

    if (res.status === 201) {
      assert.ok(
        Number(res.body.total) >= 0,
        `Se creó un pedido con total NEGATIVO (${res.body.total}): la cantidad no se valida en el servidor.`
      );
      const items: PedidoItem[] = res.body.items || [];
      const cantidades = items.map((i) => Number(i.cantidad));
      assert.ok(
        cantidades.every((c) => c > 0),
        `Se guardó una cantidad no positiva (${cantidades.join(', ')}).`
      );
    } else {
      assert.ok(
        res.status >= 400 && res.status < 500,
        `La API respondió ${res.status} en vez de rechazar la entrada inválida (debería ser 4xx).`
      );
    }
  });

  test('no se aceptan cantidades no numéricas', async () => {
    const producto = await productoPorNombre('Espresso Pocillo Colombia');
    const res = await agente().post('/api/pedidos').send({
      mesa: '1',
      cliente: MARCA_PRUEBA,
      items: [{ productoId: producto.id, cantidad: 'muchos' }],
    });

    if (res.status === 201) {
      assert.ok(
        Number.isFinite(Number(res.body.total)),
        `Se creó un pedido con total inválido (${res.body.total}).`
      );
    } else {
      assert.ok(
        res.status >= 400 && res.status < 500,
        `La API respondió ${res.status} (500 = el servidor no validó el tipo de la cantidad).`
      );
    }
  });

  test('no se aceptan reseñas sin límite de longitud', async () => {
    const res = await agente().post('/api/comentarios').send({
      autor: MARCA_PRUEBA,
      texto: 'A'.repeat(5000),
      calificacion: 5,
    });

    if (res.status === 201) {
      assert.ok(
        (res.body.texto || '').length <= 1000,
        `Se guardó una reseña de ${(res.body.texto || '').length} caracteres: falta el límite de longitud en el servidor.`
      );
    } else {
      assert.ok(
        res.status >= 400 && res.status < 500,
        `La API respondió ${res.status} en vez de rechazar la reseña.`
      );
    }
  });

  test('no se aceptan archivos ejecutables ni se escribe fuera de uploads', async () => {
    await crearUsuarioDePrueba('sec_upload', 'Sec_Clave_2024!', 'admin');
    const { cookies } = await autenticar('sec_upload', 'Sec_Clave_2024!');
    const info = await obtenerTokenCsrf(conSesion(cookies));
    const http = conSesion(unirCookies(cookies, info ? info.cookies : ''));
    const token = info ? info.token : '';

    const contenido = Buffer.from('<script>alert(1)</script>').toString('base64');

    const res = await http
      .post('/api/admin/subir-archivo', { nombre: 'prueba.html', contenidoBase64: contenido })
      .set('X-CSRF-Token', token);

    if (res.status === 200) {
      assert.ok(
        !/\.html?($|\?)/i.test(res.body.url || ''),
        `Se aceptó un archivo .html y se sirvió como ${res.body.url}: se puede ejecutar HTML desde el propio origen.`
      );
      assert.ok(
        !/\.\./.test(res.body.url || ''),
        `La URL de la subida contiene rutas relativas: ${res.body.url}`
      );
    } else {
      assert.ok(
        res.status >= 400 && res.status < 500,
        `La API respondió ${res.status} en vez de rechazar el archivo.`
      );
    }

    // Path traversal: el nombre del cliente no puede escribir fuera de uploads.
    const nombreMalicioso = '../../pwned-prueba.html';
    await http
      .post('/api/admin/subir-archivo', {
        nombre: nombreMalicioso,
        contenidoBase64: contenido,
      })
      .set('X-CSRF-Token', token);

    const posibles = [
      path.join(__dirname, '..', '..', 'pwned-prueba.html'),
      path.join(__dirname, '..', '..', '..', 'pwned-prueba.html'),
      path.join(path.sep, 'pwned-prueba.html'),
    ];
    for (const destino of posibles) {
      assert.ok(
        !fs.existsSync(destino),
        `La subida con path traversal escribió fuera de la carpeta uploads: ${destino}`
      );
    }
  });
});

/* ====================== 5. AUTENTICACIÓN Y SESIONES ====================== */

describe('Seguridad · Autenticación y sesiones', () => {
  before(async () => {
    await prepararBase();
  });

  after(async () => {
    await limpiarDatosDePrueba();
  });

  test('las contraseñas NO se guardan en texto plano', async () => {
    const { rows } = await db.query('SELECT username, password FROM usuarios');

    const enClaro = rows.filter(
      (u) => typeof u.password !== 'string' || !/^\$2[aby]\$\d{2}\$/.test(u.password)
    );

    assert.equal(
      enClaro.length,
      0,
      `Contraseñas sin hashear: ${enClaro.map((u) => u.username).join(', ')}. ` +
        'Usá bcryptjs (bcrypt.hash / bcrypt.compare). Si la base ya tenía las contraseñas en claro, ' +
        'regenerala con `docker compose down -v && docker compose up -d` o hacé que la carga inicial ' +
        'actualice los hashes.'
    );
  });

  test('la cookie de sesión lleva HttpOnly, Secure y SameSite', async () => {
    await crearUsuarioDePrueba('sec_cookie', 'Sec_Clave_2024!', 'barista');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'sec_cookie', password: 'Sec_Clave_2024!' });

    const cookie = cookieCruda(res);
    assert.ok(/HttpOnly/i.test(cookie), `La cookie de sesión no tiene HttpOnly: ${cookie}`);
    assert.ok(/SameSite/i.test(cookie), `La cookie de sesión no tiene SameSite: ${cookie}`);

    // La bandera Secure tiene que estar configurada. En producción se envía
    // siempre; en desarrollo se activa por entorno, para que la demo local
    // (curl / Postman) siga funcionando sobre HTTP plano.
    if (process.env.NODE_ENV === 'production') {
      assert.ok(/Secure/i.test(cookie), `La cookie de sesión no tiene Secure: ${cookie}`);
    } else {
      const fuente = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'middleware', 'sesion.ts'),
        'utf8'
      );
      assert.ok(
        /secure\s*:/.test(fuente),
        'La cookie de sesión no configura la bandera Secure (src/middleware/sesion.ts).'
      );
    }
  });

  test('el identificador de sesión es aleatorio y no predecible', async () => {
    await crearUsuarioDePrueba('sec_sid', 'Sec_Clave_2024!', 'barista');

    const ids = [];
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'sec_sid', password: 'Sec_Clave_2024!' });
      ids.push(valorSid(cookieCruda(res)));
    }

    assert.equal(
      new Set(ids).size,
      3,
      `Dos sesiones comparten identificador: ${ids.join(', ')}`
    );

    ids.forEach((id) => {
      assert.ok(id, 'No se pudo leer el identificador de la cookie de sesión.');
      assert.ok(!/^\d+$/.test(id), `El identificador de sesión "${id}" es numérico: se adivina al instante.`);
      assert.ok(!/^sesion[-_]?\d+$/i.test(id), `El identificador de sesión "${id}" es un contador.`);
      assert.ok(id.length >= 16, `El identificador de sesión "${id}" es demasiado corto (${id.length} caracteres).`);
    });
  });

  test('el logout invalida la sesión en el servidor', async () => {
    await crearUsuarioDePrueba('sec_logout', 'Sec_Clave_2024!', 'barista');

    const { res: loginRes, cookies, sid } = await autenticar('sec_logout', 'Sec_Clave_2024!');
    assert.equal(loginRes.status, 200, 'No se pudo iniciar sesión con el usuario de prueba.');
    assert.ok(sid, 'No se pudo leer la cookie de sesión.');

    const antes = await request(app).get('/api/auth/yo').set('Cookie', `sid=${sid}`);
    assert.equal(antes.status, 200, 'La sesión no estaba activa antes del logout.');

    const info = await obtenerTokenCsrf(conSesion(cookies));
    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', unirCookies(cookies, info ? info.cookies : ''))
      .set('X-CSRF-Token', info ? info.token : '')
      .send(info ? { _csrf: info.token } : {});

    const despues = await request(app).get('/api/auth/yo').set('Cookie', `sid=${sid}`);
    assert.equal(
      despues.status,
      401,
      'La sesión sigue viva en el servidor después del logout: hay que borrarla del almacén de sesiones, no sólo la cookie.'
    );
  });

  test('un usuario sin rol admin NO puede entrar al panel', async () => {
    const { res } = await crearUsuarioDePrueba('sec_autoriz', 'Sec_Clave_2024!', 'cliente');
    assert.equal(res.status, 200, 'No se pudo iniciar sesión con el usuario de prueba.');

    const { cookies } = await autenticar('sec_autoriz', 'Sec_Clave_2024!');
    const http = conSesion(cookies);

    for (const [metodo, ruta] of [
      ['get', '/api/admin/usuarios'],
      ['get', '/api/admin/productos'],
    ] as const) {
      const res = await http[metodo](ruta);
      assert.ok(
        res.status === 403 || res.status === 401,
        `Un usuario con rol "cliente" accedió a ${ruta} (status ${res.status}): falta el control de roles.`
      );
    }
  });

  test('un usuario NO puede cambiar su propio rol a admin', async () => {
    const { res, id } = await crearUsuarioDePrueba('sec_escalada', 'Sec_Clave_2024!', 'cliente');
    assert.equal(res.status, 200, 'No se pudo iniciar sesión con el usuario de prueba.');
    assert.ok(id, 'No se pudo obtener el id del usuario de prueba.');

    const { cookies } = await autenticar('sec_escalada', 'Sec_Clave_2024!');
    const http = conSesion(cookies);

    await http.put(`/api/admin/usuarios/${id}`, { rol: 'admin' });

    const { rows } = await db.query('SELECT rol FROM usuarios WHERE username = $1', ['sec_escalada']);
    assert.equal(
      rows[0].rol,
      'cliente',
      `El usuario se auto-asignó el rol "${rows[0].rol}": escalada de privilegios sin verificar el rol de quien lo pide.`
    );
  });
});

/* ====================== 6. INYECCIÓN DE COMANDOS ====================== */

describe('Seguridad · Inyección de comandos', () => {
  before(async () => {
    await prepararBase();
  });

  after(async () => {
    await limpiarDatosDePrueba();
  });

  test('el endpoint de conexión NO ejecuta el comando inyectado', async () => {
    await crearUsuarioDePrueba('sec_cmd', 'Sec_Clave_2024!', 'admin');
    const { cookies } = await autenticar('sec_cmd', 'Sec_Clave_2024!');
    const info = await obtenerTokenCsrf(conSesion(cookies));
    const http = conSesion(unirCookies(cookies, info ? info.cookies : ''));

    const marcador = 'INYECCION_DETECTADA';
    const res = await http
      .post('/api/admin/probar-conexion', { host: `127.0.0.1; echo ${marcador}` })
      .set('X-CSRF-Token', info ? info.token : '');

    const salida = `${res.body.salida || ''}\n${res.body.error || ''}`;
    assert.ok(
      !salida.includes(marcador),
      `El comando inyectado se ejecutó y devolvió "${marcador}". Usá spawn() con argumentos separados y shell:false, ` +
        'y validá el host contra una lista blanca.'
    );
  });

  test('el endpoint de conexión NO ejecuta un segundo comando encadenado', async () => {
    await crearUsuarioDePrueba('sec_cmd2', 'Sec_Clave_2024!', 'admin');
    const { cookies } = await autenticar('sec_cmd2', 'Sec_Clave_2024!');
    const info = await obtenerTokenCsrf(conSesion(cookies));
    const http = conSesion(unirCookies(cookies, info ? info.cookies : ''));

    const res = await http
      .post('/api/admin/probar-conexion', { host: '127.0.0.1 && id' })
      .set('X-CSRF-Token', info ? info.token : '');

    const salida = `${res.body.salida || ''}\n${res.body.error || ''}`;
    assert.ok(
      !salida.includes('uid='),
      `El comando "id" se ejecutó dentro del servidor: ${salida}`
    );
  });
});

/* =================== 7. CONFIGURACIÓN Y EXPOSICIÓN =================== */

describe('Seguridad · Configuración y exposición de información', () => {
  before(async () => {
    await prepararBase();
  });

  test('el endpoint de diagnóstico NO expone secretos', async () => {
    const res = await request(app).get('/api/_diagnostico');
    const texto = cuerpo(res);

    if (res.status === 200) {
      assert.ok(
        !/"password"\s*:/i.test(texto),
        `El diagnóstico expone contraseñas: ${texto.slice(0, 200)}`
      );
      assert.ok(
        !/DB_PASSWORD/.test(texto),
        'El diagnóstico expone el process.env completo (incluye DB_PASSWORD).'
      );
      assert.ok(
        !/postgres/.test(texto),
        'El diagnóstico expone las credenciales de la base de datos.'
      );
    } else {
      assert.ok(
        res.status === 401 || res.status === 403 || res.status === 404,
        `El endpoint de diagnóstico respondió ${res.status}: debería estar protegido o eliminado.`
      );
    }
  });

  test('la API NO devuelve stack traces al cliente', async () => {
    const res = await agente().post('/api/pedidos').send({
      mesa: '1',
      cliente: 'Prueba',
      items: [{ productoId: 999999, cantidad: 1 }],
    });
    const texto = cuerpo(res);

    assert.ok(!/"stack"/.test(texto), 'La respuesta incluye el stack trace del error.');
    assert.ok(
      !/\bat\s+\S+:\d+:\d+/.test(texto),
      `La respuesta incluye trazas de archivos: ${texto.slice(0, 200)}`
    );
  });

  test('el sitio envía cabeceras de seguridad', async () => {
    const res = await request(app).get('/');
    const headers = res.headers;

    assert.ok(
      headers['content-security-policy'],
      'Falta la cabecera Content-Security-Policy (probá helmet con contentSecurityPolicy).'
    );
    assert.ok(
      /nosniff/i.test(headers['x-content-type-options'] || ''),
      'Falta X-Content-Type-Options: nosniff.'
    );
    assert.ok(
      headers['x-frame-options'] || /frame-ancestors/i.test(headers['content-security-policy'] || ''),
      'Falta la protección contra clickjacking (X-Frame-Options o frame-ancestors).'
    );
    assert.ok(headers['referrer-policy'], 'Falta la cabecera Referrer-Policy.');
  });
});

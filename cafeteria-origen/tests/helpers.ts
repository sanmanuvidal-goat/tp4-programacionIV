import { after } from 'node:test';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app';
import * as db from '../src/db';
import { inicializarBase } from '../src/inicializar';
import type { ProductoConPrecio, Rol } from '../src/tipos';

export { app };

/** Agente de supertest (conserva las cookies entre peticiones). */
export type Agente = ReturnType<typeof request.agent>;

/** Cuerpo JSON de una petición. */
type Cuerpo = Record<string, unknown>;

// El pool de PostgreSQL mantiene clientes abiertos: sin cerrarlos, el proceso
// de test queda esperando y la corrida tarda minutos. Se cierra al terminar.
after(async () => {
  await db.pool.end();
});

/**
 * Helpers compartidos por los tests.
 *
 * Los tests son FUNCIONALES: describen el comportamiento esperado del
 * catálogo, los pedidos y el login. Deben quedar en verde ANTES de las
 * correcciones de seguridad y seguir en verde DESPUÉS de ellas.
 *
 * Para que no se rompan al agregar un token anti-CSRF, el helper busca el
 * token si la aplicación ya lo expone y lo manda; si no existe, sigue
 * adelante. Lo mismo con el rate limiting: se hacen pocos intentos fallidos
 * para no chocar con el límite.
 */

/** Prepara la base de datos (crea las tablas y carga los datos iniciales). */
export async function prepararBase(): Promise<void> {
  await inicializarBase();
}

/** Agente que conserva la cookie de sesión entre peticiones. */
export function agente(): Agente {
  return request.agent(app);
}

/**
 * Devuelve el token anti-CSRF si la aplicación lo expone.
 * Antes de las correcciones devuelve null (no hay token).
 *
 * Se prueban varias rutas posibles porque cada grupo puede llamarle distinto
 * al endpoint (por ejemplo /api/csrf-token o /api/auth/csrf-token).
 */
export async function tokenCsrf(agenteHttp: Agente): Promise<string | null> {
  const rutas = ['/api/csrf-token', '/api/auth/csrf-token', '/api/auth/csrf', '/api/csrf'];
  for (const ruta of rutas) {
    try {
      const res = await agenteHttp.get(ruta);
      if (res.status === 200 && res.body) {
        if (res.body.token) return res.body.token;
        if (res.body.csrfToken) return res.body.csrfToken;
      }
    } catch (err) {
      /* esa ruta no existe: la app todavía no expone el token */
    }
  }
  return null;
}

/** POST con token anti-CSRF si existe. */
export async function postConToken(agenteHttp: Agente, url: string, cuerpo?: Cuerpo) {
  const token = await tokenCsrf(agenteHttp);
  const payload: Cuerpo = Object.assign({}, cuerpo || {});
  if (token) payload._csrf = token;
  return agenteHttp.post(url).send(payload);
}

/** PUT con token anti-CSRF si existe. */
export async function putConToken(agenteHttp: Agente, url: string, cuerpo?: Cuerpo) {
  const token = await tokenCsrf(agenteHttp);
  const payload: Cuerpo = Object.assign({}, cuerpo || {});
  if (token) payload._csrf = token;
  return agenteHttp.put(url).send(payload);
}

/** PATCH con token anti-CSRF si existe. */
export async function patchConToken(agenteHttp: Agente, url: string, cuerpo?: Cuerpo) {
  const token = await tokenCsrf(agenteHttp);
  const payload: Cuerpo = Object.assign({}, cuerpo || {});
  if (token) payload._csrf = token;
  return agenteHttp.patch(url).send(payload);
}

/** DELETE con token anti-CSRF si existe. */
export async function deleteConToken(agenteHttp: Agente, url: string) {
  const token = await tokenCsrf(agenteHttp);
  const urlConToken = token ? `${url}?_csrf=${encodeURIComponent(token)}` : url;
  return agenteHttp.delete(urlConToken);
}

/** Inicia sesión con un usuario de prueba. */
export async function login(agenteHttp: Agente, username: string, password: string) {
  const token = await tokenCsrf(agenteHttp);
  const cuerpo: Cuerpo = { username, password };
  if (token) cuerpo._csrf = token;
  return agenteHttp.post('/api/auth/login').send(cuerpo);
}

/**
 * Busca un producto del catálogo por nombre y devuelve su id y su precio.
 * Se usa en los tests para no depender de los ids concretos.
 */
export async function productoPorNombre(nombre: string): Promise<ProductoConPrecio> {
  const res = await agente().get('/api/productos');
  const productos: ProductoConPrecio[] = res.body.productos || [];
  const encontrado = productos.find((p) => p.nombre === nombre);
  if (!encontrado) throw new Error(`El producto "${nombre}" no está en el catálogo`);
  return encontrado;
}

/**
 * Crea un usuario de prueba con una contraseña conocida y verifica que se
 * pueda iniciar sesión con él.
 *
 * NO depende de las contraseñas de la carga inicial (que los alumnos pueden
 * cambiar) y, sobre todo, NO provoca un login fallido: el rate limiting
 * cuenta los intentos fallidos y bloquearía el resto de la suite.
 *
 * Para saber en qué formato guarda la app las contraseñas se mira la propia
 * tabla: si algún hash de bcrypt ($2a$ / $2b$ / $2y$) está guardado, la app
 * hashea y se inserta el hash; si no, se inserta el texto plano.
 *
 * En el resultado, `hash` indica si la aplicación guarda las contraseñas hasheadas.
 */
export async function crearUsuarioDePrueba(username: string, password: string, rol: Rol = 'barista') {
  const { rows: muestra } = await db.query(
    "SELECT password FROM usuarios WHERE password LIKE '$2%' LIMIT 1"
  );
  const usaHash = muestra.length > 0;

  let valor = password;
  if (usaHash) {
    valor = await bcrypt.hash(password, 12);
  }

  await db.query(
    `INSERT INTO usuarios (username, password, rol, nombre)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password, rol = EXCLUDED.rol`,
    [username, valor, rol, 'Usuario de prueba']
  );

  const res = await login(agente(), username, password);
  const { rows } = await db.query('SELECT id FROM usuarios WHERE username = $1', [username]);

  const id: number | null = rows[0] ? rows[0].id : null;
  return { res, id, hash: usaHash };
}

/** Elimina un usuario de prueba de la base. */
export async function borrarUsuarioDePrueba(username: string): Promise<void> {
  await db.query('DELETE FROM usuarios WHERE username = $1', [username]);
}

/**
 * Devuelve la cabecera Set-Cookie cruda de una respuesta, tal cual la manda
 * el servidor (sirve para verificar las banderas de la cookie de sesión).
 */
export function cookieCruda(res: request.Response): string {
  const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
  if (!setCookie || !setCookie.length) return '';
  return setCookie[0];
}

/**
 * Marca con la que la batería de seguridad identifica los datos que crea
 * (pedidos, reseñas). Permite borrarlos al terminar.
 */
export const MARCA_PRUEBA = '__seguridad__';

/**
 * Borra los datos que creó la batería de seguridad: los pedidos y las reseñas
 * marcados, y los usuarios de prueba (`sec_*`).
 *
 * Esto NO es opcional: sobre la versión vulnerable, la batería deja pedidos con
 * total negativo y con total `NaN` (el `NaN` arruina cualquier `SUM` de la
 * base y hace fallar los tests funcionales de facturación). La batería tiene
 * que dejar la base como la encontró, así que los tests funcionales siguen
 * dando verde después de correr la de seguridad.
 */
export async function limpiarDatosDePrueba(): Promise<void> {
  await db.query('DELETE FROM pedidos WHERE cliente = $1', [MARCA_PRUEBA]);
  await db.query('DELETE FROM comentarios WHERE autor = $1', [MARCA_PRUEBA]);
  await db.query("DELETE FROM usuarios WHERE username LIKE 'sec\\_%'");
}

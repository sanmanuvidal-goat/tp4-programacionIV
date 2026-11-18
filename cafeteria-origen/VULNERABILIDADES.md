# 📋 Catálogo de Vulnerabilidades — Cafetería Origen

> **DOCUMENTO DOCENTE — CONTIENE TODAS LAS RESPUESTAS.**
> No distribuirlo a los alumnos antes de la entrega.
>
> Este documento es el **inventario completo** de las fallas de seguridad
> sembradas en el proyecto: dónde están, por qué existen, cómo se observan
> (a mano, contra el `localhost`) y cómo se corrigen.
>
> - Para **dar el práctico**: `GUIA-PRACTICA.md` (los alumnos) y `SOLUCIONES.md` (el código de las correcciones).
> - Para **evaluar**: `npm run check:security` → 37 controles, hoy fallan **34**;
>   y `npm run test:seguridad` → 29 tests, hoy fallan **28**.

**Proyecto:** Cafetería Origen · Node.js + TypeScript + Express + PostgreSQL 16 en Docker
**Alcance:** aplicación web + API REST + panel de administración

---

## Índice

- [Resumen](#resumen)
- [Qué test detecta cada falla](#qué-test-detecta-cada-falla)
- [1. Inyección SQL](#1-inyección-sql)
- [2. Cross-Site Scripting](#2-cross-site-scripting-xss)
- [3. Cross-Site Request Forgery](#3-cross-site-request-forgery-csrf)
- [4. Validación de entrada débil](#4-validación-de-entrada-débil-o-insuficiente)
- [5. Autenticación insegura y sesiones](#5-autenticación-insegura-y-gestión-de-sesiones)
- [6. Inyección de comandos](#6-inyección-de-comandos-del-sistema-operativo)
- [7. Configuración y exposición de información](#7-configuración-y-exposición-de-información)
- [Mapa contra los checklists del apunte](#mapa-contra-los-checklists-del-apunte)
- [Cómo usar el catálogo en la evaluación](#cómo-usar-este-catálogo-en-la-evaluación)

---

## Resumen

| ID | Vulnerabilidad | Ubicación | Sev. | OWASP | Controles |
|---|---|---|---|---|---|
| VUL-01 | Inyección SQL en el login | `services/usuarios.service.ts:42` | **Alta** | A03 | SQLI-01, SQLI-02 |
| VUL-02 | Inyección SQL en los filtros del catálogo | `services/catalogo.service.ts:40-43` | **Alta** | A03 | SQLI-01, SQLI-02 |
| VUL-03 | Inyección SQL en el filtro por mesa | `services/pedidos.service.ts:95` | **Alta** | A03 | SQLI-01, SQLI-02 |
| VUL-04 | Inyección SQL en el reporte por origen | `services/reportes.service.ts:84` | **Alta** | A03 | SQLI-01, SQLI-02 |
| VUL-05 | XSS reflejado en el buscador | `public/js/app.js:130` | **Alta** | A03 | XSS-01 |
| VUL-06 | XSS reflejado en los mensajes del server | `routes/productos.routes.ts:58`, `routes/auth.routes.ts:39` | Media | A03 | XSS-02 |
| VUL-07 | XSS almacenado en las reseñas | `public/js/app.js:259` | **Alta** | A03 | XSS-01 |
| VUL-08 | XSS de DOM en el panel | `public/js/admin.js:427` | Media | A03 | XSS-01 |
| VUL-09 | CSRF en los formularios que cambian estado | `routes/pedidos.routes.ts:18`, `routes/comentarios.routes.ts:24`, `routes/admin.routes.ts:69,83,101,119` | **Alta** | A01 | CSRF-01, CSRF-02 |
| VUL-10 | Validación de entrada ausente en pedidos | `services/pedidos.service.ts:41-64` | **Alta** | A04 | VAL-01, VAL-02, VAL-03 |
| VUL-11 | Validación de entrada ausente en reseñas | `routes/comentarios.routes.ts:24` | Media | A04 | VAL-02 |
| VUL-12 | Subida de archivos sin restricciones | `routes/admin.routes.ts:180-196` | **Alta** | A04 | VAL-04, VAL-05 |
| VUL-13 | Contraseñas almacenadas en texto plano | `services/usuarios.service.ts:42`, `inicializar.ts:24-48` | **Alta** | A02 | AUTH-01, AUTH-02, AUTH-03 |
| VUL-14 | Sin protección contra fuerza bruta | `routes/auth.routes.ts:18` | **Alta** | A07 | AUTH-04 |
| VUL-15 | Cookie de sesión sin HttpOnly / Secure / SameSite | `middleware/sesion.ts:62` | **Alta** | A05 | AUTH-05, AUTH-06, CSRF-02 |
| VUL-16 | Identificador de sesión predecible | `middleware/sesion.ts:30,52` | **Alta** | A07 | AUTH-07, AUTH-08 |
| VUL-17 | Las sesiones nunca expiran | `middleware/sesion.ts:58` | Media | A07 | AUTH-09, AUTH-10 |
| VUL-18 | El logout no invalida la sesión en el servidor | `routes/auth.routes.ts:69-72` | Media | A07 | AUTH-11 |
| VUL-19 | Enumeración de usuarios | `routes/auth.routes.ts:39` | Media | A07 | AUTH-12 |
| VUL-20 | Autorización ausente: cualquiera entra al panel | `routes/admin.routes.ts:31` | **Alta** | A01 | AUTH-14 |
| VUL-21 | Escalada de privilegios (cambiar el rol) | `routes/admin.routes.ts:49-65` | **Alta** | A01 | AUTH-15 |
| VUL-22 | Inyección de comandos del sistema operativo | `routes/admin.routes.ts:149-160` | **Alta** | A03 | CMD-01, CMD-02, CMD-03 |
| VUL-23 | Exposición de secretos por `/api/_diagnostico` | `routes/debug.routes.ts:17-28` | **Alta** | A01 | CFG-03, CFG-04 |
| VUL-24 | Stack traces enviados al cliente | `middleware/errores.ts:30` | Media | A05 | VAL-06 |
| VUL-25 | Sin cabeceras de seguridad (helmet / CSP) | `app.ts:26-27` | Media | A05 | XSS-03, CFG-01 |
| VUL-26 | Base de datos sin contraseña y con superusuario | `docker-compose.yml:25,29,60,61` | **Alta** | A05 | SQLI-03, SQLI-05 |
| VUL-27 | Credenciales por defecto | `config.ts:36-39`, `inicializar.ts:23-48` | Media | A07 | AUTH-13 |
| VUL-28 | IDOR: pedidos y datos de otros clientes | `routes/pedidos.routes.ts:36,48` | Media | A01 | — |

**Totales:** 28 fallas · 15 de severidad alta · 6 categorías del apunte · 37 controles evaluados.

### Qué test detecta cada falla

La **batería de seguridad** (`npm run test:seguridad`, 29 tests en 9 bloques)
comprueba, sobre la API ya corregida, que cada falla haya quedado resuelta.
Es el complemento del checklist estático: el checker mira el **código**, la
batería mira el **comportamiento**.

| Falla | Test que la detecta | Archivo de test |
|---|---|---|
| VUL-01 · SQLi en el login | `el login NO acepta el bypass con payload SQL` · `el login NO acepta el payload que comenta la contraseña` | `seguridad-login.test.ts` |
| VUL-02 · SQLi en los filtros del catálogo | `la búsqueda del catálogo NO se puede ampliar con SQL` · `el filtro por origen NO se puede ampliar con SQL` | `seguridad.test.ts` |
| VUL-03 · SQLi en el filtro por mesa | `el filtro por mesa NO se puede ampliar con SQL` | `seguridad.test.ts` |
| VUL-04 · SQLi en el reporte por origen | `el reporte por origen NO filtra otras tablas con UNION` | `seguridad.test.ts` |
| VUL-05 · XSS reflejado en el buscador | `el cliente NO inserta datos con innerHTML` | `seguridad.test.ts` |
| VUL-06 · XSS reflejado en los mensajes | `el servidor NO devuelve HTML sin escapar en los errores` · `el login NO devuelve HTML sin escapar en el mensaje de error` | `seguridad.test.ts` |
| VUL-07 · XSS almacenado en las reseñas | `el cliente NO inserta datos con innerHTML` | `seguridad.test.ts` |
| VUL-08 · XSS de DOM en el panel | `el cliente NO inserta datos con innerHTML` | `seguridad.test.ts` |
| VUL-09 · CSRF | `existe un token anti-CSRF y las peticiones sin token se rechazan` | `seguridad.test.ts` |
| VUL-10 · Validación en pedidos | `no se aceptan cantidades negativas` · `no se aceptan cantidades no numéricas` | `seguridad.test.ts` |
| VUL-11 · Reseñas sin límite | `no se aceptan reseñas sin límite de longitud` | `seguridad.test.ts` |
| VUL-12 · Subida de archivos | `no se aceptan archivos ejecutables ni se escribe fuera de uploads` | `seguridad.test.ts` |
| VUL-13 · Contraseñas en texto plano | `las contraseñas NO se guardan en texto plano` | `seguridad.test.ts` |
| VUL-14 · Sin protección contra fuerza bruta | `el login bloquea o limita los intentos repetidos` | `seguridad-fuerza-bruta.test.ts` |
| VUL-15 · Cookie sin HttpOnly/Secure/SameSite | `la cookie de sesión lleva HttpOnly, Secure y SameSite` | `seguridad.test.ts` |
| VUL-16 · ID de sesión predecible | `el identificador de sesión es aleatorio y no predecible` | `seguridad.test.ts` |
| VUL-17 · Las sesiones nunca expiran | — (sólo el control estático AUTH-09/10) | — |
| VUL-18 · El logout no invalida en el servidor | `el logout invalida la sesión en el servidor` | `seguridad.test.ts` |
| VUL-19 · Enumeración de usuarios | `los mensajes de login son genéricos (sin enumeración de usuarios)` | `seguridad-login.test.ts` |
| VUL-20 · Autorización ausente | `un usuario sin rol admin NO puede entrar al panel` | `seguridad.test.ts` |
| VUL-21 · Escalada de privilegios | `un usuario NO puede cambiar su propio rol a admin` | `seguridad.test.ts` |
| VUL-22 · Inyección de comandos | `el endpoint de conexión NO ejecuta el comando inyectado` · `el endpoint de conexión NO ejecuta un segundo comando encadenado` | `seguridad.test.ts` |
| VUL-23 · Secretos por `/api/_diagnostico` | `el endpoint de diagnóstico NO expone secretos` | `seguridad.test.ts` |
| VUL-24 · Stack traces al cliente | `la API NO devuelve stack traces al cliente` | `seguridad.test.ts` |
| VUL-25 · Sin cabeceras de seguridad | `el sitio envía cabeceras de seguridad` | `seguridad.test.ts` |
| VUL-26 · Base de datos sin contraseña / superusuario | `la aplicación NO se conecta con un superusuario de la base` | `seguridad.test.ts` |
| VUL-27 · Credenciales por defecto | — (sólo el control estático AUTH-13) | — |
| VUL-28 · IDOR | — (es un control de diseño: se evalúa leyendo el código) | — |

> **Estado esperado de la batería:** al arrancar **28 de 29 tests en rojo** (sólo
> pasa el sanity check del login correcto); al terminar las correcciones,
> **29 de 29 en verde**. La batería se validó contra una implementación de
> referencia completa: es **pasable**, no una trampa.

---

## 1. Inyección SQL

> **OWASP A03:2021 — Inyección.** El motor de PostgreSQL interpreta las comillas y
> los operadores que vienen en la entrada del usuario como parte de la consulta.
> La aplicación confía ciegamente en lo que recibe.

### VUL-01 · Login — el más importante

**Dónde:** `src/services/usuarios.service.ts:42`

```js
const sql = `SELECT * FROM usuarios WHERE username = '${username}' AND password = '${password}'`;
const { rows } = await db.query(sql);
```

**Por qué ocurre:** el nombre de usuario y la contraseña se **concatenan** al texto
SQL. El `'` que abre la cadena del código se cierra con el `'` del atacante y el
resto de su texto pasa a ser SQL.

**Cómo se observa (manual, local):**

1. Panel → login → usuario: `' OR 1=1 --` · contraseña: `cualquiera` → **entra como admin**.
2. Variante con credenciales reales: `admin'--` → entra sin contraseña.
3. Comprobación en la BD: `docker compose exec db psql -U postgres -d origen -c "SELECT username FROM usuarios;"` → se listan todos.

**Cómo se mitiga:** consulta parametrizada + comparación con bcrypt.
El control **AUTH-03** (`bcrypt.compare`) es inseparable de éste: aunque la
consulta se parametrize, seguir comparando en texto plano deja la puerta abierta.

```js
const { rows } = await db.query('SELECT * FROM usuarios WHERE username = $1', [username]);
const usuario = rows[0];
if (!usuario) return null;
const coincide = await bcrypt.compare(password, usuario.password);
return coincide ? usuario : null;
```

**Controles:** SQLI-01, SQLI-02, AUTH-03 · **Práctica:** 1

---

### VUL-02 · Filtros del catálogo

**Dónde:** `src/services/catalogo.service.ts:40-43` (tipo), `:41` (variedad), `:43` (búsqueda)

```js
if (tipo) sql += ` AND tipo = '${tipo}'`;
if (variedad) sql += ` AND variedad = '${variedad}'`;
if (q) sql += ` AND (nombre ILIKE '%${q}%' OR descripcion ILIKE '%${q}%')`;
```

**Cómo se observa:** en el buscador del menú, `q = ' OR '1'='1` → devuelve **los 20
productos** en lugar de los que coinciden. También `' OR 1=1 --`.

**Cómo se mitiga:** parametrizar (`$1`, `$2`, …) y armar la consulta una sola vez
con un array de condiciones.

---

### VUL-03 · Filtro por mesa

**Dónde:** `src/services/pedidos.service.ts:95`

```js
if (mesa) sql += ` WHERE mesa = '${mesa}'`;
```

**Cómo se observa:** `GET /api/pedidos?mesa=' OR '1'='1` → devuelve los pedidos de
**todas** las mesas (los datos de los demás clientes).

**Cómo se mitiga:** `WHERE mesa = $1` con el valor en el array de parámetros.

---

### VUL-04 · Reporte por origen — el mejor para un `UNION`

**Dónde:** `src/services/reportes.service.ts:84`

```js
WHERE pr.variedad = '${variedad}'
```

**Cómo se observa (el clásico `UNION`):**

```
GET /api/reportes/ventas-por-variedad?variedad=Brasil' UNION SELECT username, password, 1, 1 FROM usuarios--
```

→ el reporte devuelve **los usuarios y las contraseñas en texto plano** de la
tabla que la app nunca debería exponer. Es la demostración más clara de por qué
una inyección SQL puede leer otras tablas.

**Cómo se mitiga:** parametrizar + validar el origen contra lista blanca
(`Brasil` / `Colombia` / `Etiopía`).

---

## 2. Cross-Site Scripting (XSS)

> **OWASP A03:2021 — XSS.** El navegador no distingue si el script vino del
> desarrollador o del atacante: si logra llegar al HTML, se ejecuta.

### VUL-05 · XSS reflejado en el buscador

**Dónde:** `src/public/js/app.js:130`

```js
el.innerHTML = 'Resultados para <strong>' + filtros.q + '</strong> — ' + total + ' producto(s)';
```

El texto buscado viene del servidor (`productos.routes.ts` devuelve `filtros` con
el eco de `q`), así que el payload vuelve al navegador y se inserta como HTML.

**Cómo se observa:** en el buscador, `<img src=x onerror=alert('XSS')>` → salta
el alert al escribir.

**Cómo se mitiga:** `el.textContent = 'Resultados para ' + filtros.q + ' — ' + total + ' producto(s)';`
(`textContent` siempre escapa). O construir el `<strong>` con nodos.

---

### VUL-06 · XSS reflejado en los mensajes del servidor

**Dónde:** `src/routes/productos.routes.ts:58` y `src/routes/auth.routes.ts:39`

```js
.json({ error: `No existe el producto "${req.params.id}".` });
.json({ error: `El usuario "${username}" no existe en el sistema.` });
```

**Cómo se observa:** `GET /api/productos/<script>alert(1)</script>` → el mensaje
de error vuelve con el payload. Y en el login, un usuario inexistente que sea un
`<script>` lo devuelve tal cual (`app.js:288` lo pinta con `innerHTML`).

**Cómo se mitiga:** mensajes **genéricos**, sin devolver la entrada:
`{ error: 'Producto no encontrado.' }` / `{ error: 'Usuario o contraseña incorrectos.' }`

---

### VUL-07 · XSS almacenado en las reseñas — el de mayor impacto

**Dónde:** `src/public/js/app.js:259`

```js
cont.innerHTML = resp.data.comentarios.map(function (c) { ... }).join('');
```

El texto de la reseña se guarda **tal cual** en la base y se inserta con
`innerHTML` en cada visita.

**Cómo se observa:**

1. Publicar una reseña con `<script>alert('XSS almacenado')</script>` en el texto.
2. Recargar → salta sola.
3. **Pedirle a un compañero que abra el sitio**: a él también le salta. El script
   queda **guardado en la base** y afecta a todos, incluidos los administradores.

**Cómo se mitiga:** en el cliente, `textContent` en vez de `innerHTML`; en el
servidor, validar longitud y formato del texto; y como capa extra, CSP.

---

### VUL-08 · XSS de DOM en el panel

**Dónde:** `src/public/js/admin.js:427`

```js
var objetivo = params.get('vista');
if (objetivo) { $('#panel-bienvenida').innerHTML = 'Panel ' + objetivo; }
```

**Cómo se observa:** abrir `admin.html?vista=<img src=x onerror=alert('DOM')>` →
se ejecuta en el navegador del admin.

**Cómo se mitiga:** `textContent` en vez de `innerHTML`, o validar el valor
contra una lista blanca antes de usarlo.

---

## 3. Cross-Site Request Forgery (CSRF)

> **OWASP A01:2021.** El navegador manda automáticamente las cookies del dominio.
> Si la app confía sólo en la cookie para autorizar, cualquier página externa
> puede hacer que el navegador de la víctima envíe la petición.

### VUL-09 · Formularios sin token anti-CSRF

**Dónde:**

| Endpoint | Archivo y línea | Acción |
|---|---|---|
| `POST /api/pedidos` | `routes/pedidos.routes.ts:18` | crear pedido |
| `POST /api/comentarios` | `routes/comentarios.routes.ts:24` | publicar reseña |
| `POST /api/admin/productos` | `routes/admin.routes.ts:69` | crear producto |
| `PUT /api/admin/productos/:id` | `routes/admin.routes.ts:83` | editar producto |
| `DELETE /api/admin/productos/:id` | `routes/admin.routes.ts:101` | borrar producto |
| `POST /api/admin/cambiar-contrasena` | `routes/admin.routes.ts:119` | cambiar contraseña |

Ninguno pide un token. Además la cookie de sesión se emite **sin `SameSite`**
(`middleware/sesion.ts:62`), así que el navegador la manda también desde otros
sitios.

**Cómo se observa (manual, local):** con el panel abierto y sesión iniciada, en
otra pestaña abrir un `ataque.html` local que haga POST automático a
`/api/pedidos` → el pedido se crea sin que el usuario lo haya pedido. Repetir con
`/api/admin/cambiar-contrasena` → la contraseña del admin cambia.

**Cómo se mitiga:**

1. **Token anti-CSRF** aleatorio por sesión, en un campo oculto o en la cabecera
   `X-CSRF-Token`, verificado en el servidor (control **CSRF-01**).
2. `sameSite: 'lax'` en la cookie (**CSRF-02**).
3. Verificación de `Origin`/`Referer` en POST/PUT/PATCH/DELETE (**CSRF-03**, recomendado).
4. Que las operaciones destructivas usen POST/PUT/DELETE y **nunca GET** (**CSRF-04**).

> Nota: el `Referer` puede faltar por privacidad del navegador. **No puede ser la
> única defensa**: va como capa adicional al token.

---

## 4. Validación de entrada débil o insuficiente

> **OWASP A04:2021.** La regla de oro es **"no confíes en el usuario"**: toda
> validación tiene que repetirse en el servidor, porque al cliente se lo puede
> saltear con el devtools.

### VUL-10 · Pedidos: cantidades y campos sin validar

**Dónde:** `src/services/pedidos.service.ts:41-64`

```js
for (const item of items) {
  const producto = await buscarProducto(item.productoId);
  const precioUnitario = calcularPrecio(producto);
  filas.push({ productoId: producto.id, cantidad: item.cantidad, precioUnitario });
}
const total = filas.reduce((acc, f) => acc + f.precioUnitario * f.cantidad, 0);
```

No se valida **tipo** (entero), **rango** (1..N), ni **longitud** de `mesa`,
`cliente` o la cantidad de items.

**Cómo se observa:**

- `POST /api/pedidos` con `{"items":[{"productoId":4,"cantidad":-5}]}` →
  **total −28700** (un pedido que le *paga* a la cafetería).
- `cantidad: "abc"` → el total queda `NaN` y se guarda como `NaN` en la base.
- `cantidad: 999999` → factura absurda (DoS / abuso de recursos).
- Con el devtools, cambiar `type="number"` por `type="text"` en el formulario y
  mandar texto donde el navegador lo bloqueaba.

**Cómo se mitiga:** un módulo `src/validacion.ts` con funciones de
**tipo / longitud / rango / lista blanca**, aplicado en el servidor
(controles **VAL-01**, **VAL-02**, **VAL-03**).

---

### VUL-11 · Reseñas sin límites

**Dónde:** `src/routes/comentarios.routes.ts:24`

No se valida longitud, formato ni que la calificación esté entre 1 y 5. Se
acepta una reseña de 50.000 caracteres (y es el vehículo del XSS almacenado).

**Cómo se mitiga:** `texto(autor, 2..40)`, `texto(mensaje, 3..280)`,
`entero(calificacion, 1..5)`.

---

### VUL-12 · Subida de archivos sin restricciones

**Dónde:** `src/routes/admin.routes.ts:180-196`

```js
const buffer = Buffer.from(contenidoBase64, 'base64');
const destino = path.join(config.uploadsDir, nombre);   // nombre del cliente
fs.writeFileSync(destino, buffer);
res.json({ url: `/uploads/${nombre}` });
```

Tres problemas en tres líneas: **no valida extensión**, **no valida el tipo MIME
real**, **no limita el tamaño**, y **el nombre lo decide el cliente** (con
`../../` se puede escribir fuera de la carpeta). Y como los archivos se sirven
con `express.static` **desde el mismo origen**, un `.html` subido es XSS
almacenado servido por el propio sitio.

**Cómo se observa (manual, local):**

1. Panel → Productos → Subir imagen → elegir un `.html` con `<script>alert(1)</script>`.
2. Abrir la URL que devuelve → el script corre **en el dominio de la cafetería**.

**Cómo se mitiga:** lista blanca de extensiones (`.png`, `.jpg`, `.webp`),
verificación del **magic number** del archivo, tamaño máximo, y **nombre generado
por el servidor** (`crypto.randomUUID()`), guardado fuera del árbol web.

---

## 5. Autenticación insegura y gestión de sesiones

> **OWASP A02 / A07.** La autenticación es *quién sos*; la autorización es
> *qué podés hacer*. Las dos cosas tienen que estar separadas.

### VUL-13 · Contraseñas en texto plano

**Dónde:** `src/services/usuarios.service.ts:42` (comparación) y
`src/inicializar.ts:24-48` (carga inicial)

```js
// inicializar.ts
INSERT INTO usuarios (username, password, rol, nombre) VALUES ($1, $2, $3, $4)
// con [usuario.username, usuario.password, ...]   ← la contraseña sin hashear
```

**Cómo se observa:**
`docker compose exec db psql -U postgres -d origen -c "SELECT username, password FROM usuarios;"`
→ las contraseñas se leen a simple vista: `admin|admin`, `valentina|origen2024`…

Si la base se filtra (una inyección SQL como VUL-04, un backup, un dump), **todas
las cuentas caen de inmediato**.

**Cómo se mitiga:** `bcrypt.hash(password, 12)` al guardar y `bcrypt.compare`
al comparar (control **AUTH-01**, **AUTH-02**, **AUTH-03**).

---

### VUL-14 · Sin protección contra fuerza bruta

**Dónde:** `src/routes/auth.routes.ts:18` — el endpoint de login no tiene ningún límite.

**Cómo se observa:** en el panel, probar a mano unas pocas contraseñas
`admin` → `password` → `123456`. No hay bloqueo, ni retardo, ni captcha, ni aviso.
Como el login además es vulnerable a inyección SQL (VUL-01), el mismo endpoint
se puede usar para leer la base completa.

**Cómo se mitiga:** `express-rate-limit` sobre `/api/auth/login` (5 intentos por
IP cada 15 min, con `skipSuccessfulRequests: true`), bloqueo temporal de cuenta
tras N fallos y **mensaje genérico** (VUL-19). Control **AUTH-04**.

---

### VUL-15 · Cookie de sesión sin HttpOnly, sin Secure y sin SameSite

**Dónde:** `src/middleware/sesion.ts:62`

```js
res.cookie('sid', id, { path: '/' });
```

**Cómo se observa:** devtools → Application → Cookies. La cookie `sid` aparece
**sin** `HttpOnly`, **sin** `Secure` y **sin** `SameSite`.

Consecuencias:

- **Sin `HttpOnly`**: cualquier XSS (VUL-05/07/08) puede leer la cookie con
  `document.cookie` y robarla.
- **Sin `Secure`**: la cookie viaja en texto plano por HTTP.
- **Sin `SameSite`**: el navegador la manda también en peticiones desde otros
  sitios → facilita el CSRF (VUL-09).

**Cómo se mitiga:**
`res.cookie('sid', id, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: ... })`.
Controles **AUTH-05**, **AUTH-06**, **CSRF-02**.

---

### VUL-16 · Identificador de sesión predecible

**Dónde:** `src/middleware/sesion.ts:30` y `:52`

```js
let contadorSesiones = 0;
...
const id = `sesion_${contadorSesiones}`;
```

**Cómo se observa:** hacer login dos veces y comparar los valores de la cookie:
`sesion_1`, `sesion_2`, `sesion_3`… El identificador es un **contador**: se
adivina al instante y permite **fijar la sesión** de otra persona (session
fixation): el atacante hace que la víctima use un id conocido.

**Cómo se mitiga:** `crypto.randomBytes(32).toString('hex')` o
`crypto.randomUUID()`, y **regenerar el id tras el login** (que es justamente lo
que hoy no pasa: el `sid` anterior sobrevive al login).

Controles **AUTH-07**, **AUTH-08**.

---

### VUL-17 · Las sesiones nunca expiran

**Dónde:** `src/middleware/sesion.ts:58` → `expiraEn: null`

Una sesión abierta queda viva **para siempre**. Si alguien se queda con la
cookie (un computer compartido, un navegador en un cybercafé), el acceso no
caduca nunca.

**Cómo se mitiga:** TTL por inactividad (30 min) y máximo absoluto (8 h), con
renovación al usarse; control **AUTH-09** y **AUTH-10**.

---

### VUL-18 · El logout no invalida la sesión en el servidor

**Dónde:** `src/routes/auth.routes.ts:69-72`

```js
router.post('/logout', (req, res) => {
  res.clearCookie('sid', { path: '/' });   // sólo borra la cookie del cliente
  res.json({ mensaje: 'Sesión cerrada.' });
});
```

La sesión **sigue viva en el servidor**. Si la cookie fue robada, "cerrar
sesión" no sirve de nada: el atacante sigue operando.

**Cómo se mitiga:** borrar la sesión del almacén del servidor y regenerar el
identificador. Control **AUTH-11**.

---

### VUL-19 · Enumeración de usuarios

**Dónde:** `src/routes/auth.routes.ts:39`

```js
return res.status(401).json({ error: `El usuario "${username}" no existe en el sistema.` });
```

Dos mensajes distintos → un atacante puede **saber qué cuentas existen** antes
de atacarlas.

**Cómo se observa:** en el login, escribir `fantasma` (no existe) y después
`valentina` (existe, contraseña incorrecta): los mensajes son distintos.

**Cómo se mitiga:** un único mensaje para los dos casos —
`"Usuario o contraseña incorrectos"`. Control **AUTH-12**.

---

### VUL-20 · Autorización ausente: cualquiera entra al panel

**Dónde:** `src/routes/admin.routes.ts:31` (y el import en `:9`)

```js
import { requiereSesion, requiereRol } from '../middleware/auth';
router.use(requiereSesion);        // ← requiereRol está importado y NO se usa
```

`requiereRol` **está implementado** (`middleware/auth.ts:27`) pero **nunca se
aplica**. Cualquier usuario autenticado —incluso con rol `cliente`— entra al
panel: crear y **borrar productos**, **cambiar contraseñas** y **ejecutar
comandos** en el servidor.

**Cómo se observa:** login con `cliente` / `cliente` → el panel carga completo
con todas las pestañas.

**Cómo se mitiga:** `router.use(requiereRol('admin'));` sobre las rutas del
panel. Control **AUTH-14**.

---

### VUL-21 · Escalada de privilegios: cualquiera se declara admin

**Dónde:** `src/routes/admin.routes.ts:49-65` (asignación en `:55`)

```js
if (rol !== undefined) cambios.rol = rol;    // ← el rol viene del cuerpo, sin verificar
```

Combinado con VUL-20, un usuario con rol `cliente` puede mandarse
`{"rol": "admin"}` y **elevarse sus propios privilegios**.

**Cómo se observa (login como `cliente`):** en la pestaña Usuarios, cambiar el
rol del propio usuario a `admin` → el panel pasa a mostrar todo como administrador.

**Cómo se mitiga:** comprobar el rol de quien hace el pedido antes de aceptar
el campo `rol`, y validar el valor contra una lista blanca. Control **AUTH-15**.

---

## 6. Inyección de comandos del sistema operativo

> **OWASP A03:2021.** La aplicación mete datos del usuario dentro de una llamada
> al shell. Como `exec` lanza `/bin/sh -c`, los operadores del shell se
> interpretan.

### VUL-22 · "Probar conexión con el proveedor"

**Dónde:** `src/routes/admin.routes.ts:149-160`

```js
const comando = `ping -c 3 ${host}`;
exec(comando, (error, stdout, stderr) => {
  res.json({ comando, salida: stdout, error: stderr || (error ? error.message : null) });
});
```

**Cómo se observa (manual, local):**

1. Panel → Herramientas → "Probar conexión con el proveedor".
2. Escribir `127.0.0.1; cat /etc/hostname` → la salida del ping **viene seguida
   del contenido de `/etc/hostname`**. El `;` cerró el comando y marital
   ejecutó otro.
3. Con `&&` o `|` se encadenan más comandos; con `$(...)` se puede inyectar la
   salida de otro comando **dentro** de un argumento.

Impacto: ejecución remota de código en el contenedor, con la permisos del
proceso Node. La salida se muestra **en la página**, así que la falla se ve
completa.

**Cómo se mitiga:**

1. **Lista blanca** de servidores permitidos (`SERVIDORES_PERMITIDOS`).
2. `spawn('ping', ['-c', '3', host], { shell: false })` → sin shell no hay
   operadores: el `;` del usuario es un argumento más.
3. Ejecutar el proceso con el **menor privilegio** posible.

Controles **CMD-01**, **CMD-02**, **CMD-03**.

---

## 7. Configuración y exposición de información

### VUL-23 · `/api/_diagnostico` filtra los secretos del servidor

**Dónde:** `src/routes/debug.routes.ts:17-28` — montado en `app.ts:46` **sin
ninguna autenticación**.

```js
entorno: process.env,
baseDeDatos: { ..., password: process.env.DB_PASSWORD },
```

**Cómo se observa:** abrir `http://localhost:8080/api/_diagnostico` **sin haber
iniciado sesión** → devuelve `DB_PASSWORD`, `DB_USER`, `NODE_ENV`, la versión de
Node, la memoria y el PID del proceso.

**Cómo se mitiga:** proteger el endpoint con `requiereSesion` + `requiereRol('admin')`
o **eliminarlo** (es lo ideal en producción), y nunca devolver `process.env`.
Controles **CFG-03**, **CFG-04**.

---

### VUL-24 · Stack traces al cliente

**Dónde:** `src/middleware/errores.ts:30`

```js
res.status(err.status || 500).json({ error: err.message, stack: err.stack });
```

**Cómo se observa:** provocar un error (por ejemplo, un `productoId` inexistente
que hace fallar el cálculo del pedido) → la respuesta JSON trae el stack trace
completo: rutas del sistema de archivos, nombres de tablas y fragmentos de SQL.

**Cómo se mitiga:** registrar el detalle en el log del servidor y responder con
un mensaje genérico: `{ error: 'Error interno del servidor.' }`. Control **VAL-06**.

---

### VUL-25 · Sin cabeceras de seguridad

**Dónde:** `src/app.ts:26-27` — no hay `helmet` ni CSP.

Sin `Content-Security-Policy` el navegador no tiene ninguna barrera extra si un
XSS logra colarse; sin `X-Content-Type-Options`, `X-Frame-Options`,
`Strict-Transport-Security` ni `Referrer-Policy` la app queda expuesta a
clickjacking y a fugas de referencia.

**Cómo se mitiga:** `app.use(helmet({ contentSecurityPolicy: { directives: {...} } }))`.
Controles **XSS-03**, **CFG-01**.

---

### VUL-26 · La base de datos acepta conexiones sin contraseña y la app es superusuario

**Dónde:** `docker-compose.yml:29`, `:25`, `:60`, `:61`

```yaml
POSTGRES_HOST_AUTH_METHOD: trust     # acepta cualquier conexión, sin clave
POSTGRES_PASSWORD: postgres
DB_USER: postgres                     # la app se conecta como superusuario
DB_PASSWORD: postgres
```

Con `trust`, cualquier proceso que alcance el puerto 5432 entra a la base sin
autenticarse. Y como la app usa el **superusuario**, cualquier inyección SQL
(las 4 de la sección 1) puede leer, modificar o **borrar cualquier tabla**, crear
usuarios o tirar la base entera.

**Cómo se observa:** `docker compose exec db psql -U postgres -d origen` entra
sin clave; y `DROP TABLE productos` desde cualquiera de los 4 puntos de
inyección.

**Cómo se mitiga:** quitar `POSTGRES_HOST_AUTH_METHOD: trust`, usar contraseña
fuerte para el superusuario, y que la app se conecte con el usuario
`origen_app` (ya creado en `docker/initdb/02-usuario-aplicacion.sql`) que sólo
tiene `SELECT/INSERT/UPDATE/DELETE` sobre las tablas.
Controles **SQLI-03**, **SQLI-05**.

---

### VUL-27 · Credenciales por defecto

**Dónde:** `src/config.ts:36-39` y `src/inicializar.ts:23-48`

```js
credencialesPorDefecto: { username: 'admin', password: 'admin' },
```

Las cuentas de ejemplo (`admin/admin`, `cliente/cliente`, `barista/cafe123`…)
son las mismas que se documentan en pantalla. En un entorno real, una cuenta
admin activa con contraseña trivial es el punto de entrada más común.

**Cómo se mitiga:** contraseñas fuertes por defecto (o generadas), cambio
obligatorio en el primer inicio de sesión, y documentar estas cuentas **sólo
para el entorno de práctica**. Control **AUTH-13** (recomendado).

---

### VUL-28 · IDOR: pedidos y datos de otros clientes

**Dónde:** `src/routes/pedidos.routes.ts:36` y `:48`

`GET /api/pedidos` y `GET /api/pedidos/:id` **no verifican que el pedido
pertenezzca a quien pregunta**. Cualquiera (incluso sin sesión) puede ver los
pedidos de todas las mesas, con el nombre del cliente.

**Cómo se observa:** sin iniciar sesión, `GET /api/pedidos` devuelve la lista
completa de pedidos y clientes de la cafetería.

**Cómo se mitiga:** verificar la pertenencia del recurso al usuario de la
sesión, o exigir el rol correspondiente (`mozo`/`barista`/`admin`).

---

## Mapa contra los checklists del apunte

Cada falla cubre ítems concretos de las planillas "Prevención de …" del apunte.

| Planilla del apunte | Fallas que la cubren | Controles del script |
|---|---|---|
| **Prevención de Inyección SQL** | VUL-01, VUL-02, VUL-03, VUL-04, VUL-26 | SQLI-01 … SQLI-05 |
| **Prevención de XSS** | VUL-05, VUL-06, VUL-07, VUL-08, VUL-25 | XSS-01 … XSS-04 |
| **Prevención de CSRF** | VUL-09, VUL-15 | CSRF-01 … CSRF-04 |
| **Prevención de Validación débil** | VUL-10, VUL-11, VUL-12, VUL-24 | VAL-01 … VAL-06 |
| **Prevención de Autenticación insegura** | VUL-13 … VUL-21, VUL-27 | AUTH-01 … AUTH-15 |
| **Command Injection (DVWA)** | VUL-22 | CMD-01 … CMD-03 |
| **OWASP Top 10 / Ajustes de configuración** | VUL-23, VUL-25, VUL-26 | CFG-01 … CFG-05 |

### Cobertura por checklist del script

| # | Control | Falla principal | Estado inicial |
|---|---|---|---|
| 1 | SQLI-01 · SQLI-02 | VUL-01/02/03/04 | ✘ falla |
| 2 | SQLI-03 | VUL-26 (`trust`) | ✘ falla |
| 3 | SQLI-04 | puerto 5432 no publicado | ✔ pasa |
| 4 | SQLI-05 | VUL-26 (superusuario) | ✘ falla |
| 5 | XSS-01 | VUL-05/07/08 | ✘ falla |
| 6 | XSS-02 | VUL-06 | ✘ falla |
| 7 | XSS-03 | VUL-25 (CSP) | ✘ falla |
| 8 | XSS-04 | VUL-11 (límites) | ○ recomendado |
| 9 | CSRF-01 | VUL-09 | ✘ falla |
| 10 | CSRF-02 | VUL-09 / VUL-15 | ✘ falla |
| 11 | CSRF-03 | — | ○ recomendado |
| 12 | CSRF-04 | métodos HTTP adecuados | ✔ pasa |
| 13 | VAL-01 | VUL-10 | ✘ falla |
| 14 | VAL-02 | VUL-10 / VUL-11 | ✘ falla |
| 15 | VAL-03 | VUL-10 | ✘ falla |
| 16 | VAL-04 | VUL-12 | ✘ falla |
| 17 | VAL-05 | VUL-12 | ✘ falla |
| 18 | VAL-06 | VUL-24 | ✘ falla |
| 19 | AUTH-01 | VUL-13 | ✘ falla |
| 20 | AUTH-02 | VUL-13 | ✘ falla |
| 21 | AUTH-03 | VUL-13 | ✘ falla |
| 22 | AUTH-04 | VUL-14 | ✘ falla |
| 23 | AUTH-05 | VUL-15 | ✘ falla |
| 24 | AUTH-06 | VUL-15 | ✘ falla |
| 25 | AUTH-07 | VUL-16 | ✘ falla |
| 26 | AUTH-08 | VUL-16 | ✘ falla |
| 27 | AUTH-09 | VUL-17 | ✘ falla |
| 28 | AUTH-10 | VUL-17 | ✘ falla |
| 29 | AUTH-11 | VUL-18 | ✘ falla |
| 30 | AUTH-12 | VUL-19 | ✘ falla |
| 31 | AUTH-13 | VUL-27 | ○ recomendado |
| 32 | AUTH-14 | VUL-20 | ✘ falla |
| 33 | AUTH-15 | VUL-21 | ○ recomendado |
| 34 | CMD-01 | VUL-22 | ✘ falla |
| 35 | CMD-02 | VUL-22 | ✘ falla |
| 36 | CMD-03 | VUL-22 | ✘ falla |
| 37 | CFG-01 | VUL-25 | ✘ falla |
| 38 | CFG-02 | secretos en el código | ✘ falla |
| 39 | CFG-03 | VUL-23 | ✘ falla |
| 40 | CFG-04 | VUL-23 | ✘ falla |
| 41 | CFG-05 | usuario no root en el Dockerfile | ○ recomendado |

**Estado inicial verificado:** 3 controles ✔ / 34 críticos ✘ / 5 recomendados ○.

---

## Cómo usar este catálogo en la evaluación

### 1. Correr el checklist automático

```bash
docker compose exec app npm run check:security
```

El script **no explota nada**: analiza el código estáticamente, igual que las
planillas de revisión del apunte. Devuelve código de salida 1 mientras queden
controles críticos sin cubrir. Cada control muestra el **archivo y la línea**
donde está el problema, lo que sirve de pista para los alumnos.

### 2. Cruzarlo con el informe del grupo

El informe de cada grupo debería cubrir, por falla: qué es, **dónde está**,
**cómo se observa**, por qué ocurre, cómo se corrige y cómo se verifica.
Este catálogo es la lista contra la que se coteja. Si un grupo encuentra una
falla **que no está en esta lista**, es un hallazgo extra y se bonifica.

### 3. Verificar que la app sigue funcionando

```bash
docker compose exec app npm test
```

Los 28 tests son **funcionales**: tienen que estar en verde **antes y después**
de las correcciones. Los helpers (`tests/helpers.ts`) detectan solos el token
anti-CSRF si existe, así que agregar CSRF no rompe la suite.

### 4. Correr la batería de seguridad

```bash
docker compose exec app npm run test:seguridad
```

Son **29 tests** que comprueban que las fallas estén **corregidas**, mirando el
comportamiento de la API y no el código. Al arrancar fallan **28 de 29**
(sólo pasa el sanity check del login correcto); con la implementación de
referencia completa quedan **29 de 29 en verde**. El mapeo falla → test está
en la tabla [Qué test detecta cada falla](#qué-test-detecta-cada-falla).

Ventaja frente al checklist: el checklist puede dar un falso positivo (el
código "parece" mal pero el comportamiento está bien) o un falso negativo (el
código reza bien pero no funciona). La batería prueba el comportamiento real.

### 5. Errores que restan puntos

- Romper los tests o la funcionalidad del negocio.
- "Corregir" **borrando la funcionalidad** (por ejemplo, sacar el filtro del
  menú para que no haya inyección).
- Dejar secretos o la contraseña del admin en el repositorio.
- Usar una **blacklist** (lista de caracteres prohibidos) en vez de una
  **lista blanca** (lista de valores permitidos).
- Poner el token CSRF en el HTML con un valor fijo que valga para siempre.
- Marcar como "corregido" sin que el checklist lo confirme.
- **Borrar, saltear o maquillar los tests de seguridad** para que la batería
  pase en verde.

---

## Nota final sobre los límites de la práctica

Todo lo de este documento se hace **contra la instalación local** (`localhost`)
del proyecto. Las técnicas descritas son de dominio público y están
documentadas en OWASP, pero:

- **Practicar sólo en entornos controlados** y con aplicaciones diseñadas para
  aprender (DVWA, Juice Shop, WebGoat — como los que menciona el apunte).
- **Probar estas técnicas contra sistemas ajenos sin autorización es ilegal.**
- La observación debe ser **manual**: el apunte es explícito en no automatizar
  los ataques (ni la fuerza bruta, ni el CSRF).

El objetivo del ejercicio es **entender el código que falla y defenderlo**, no
generar un atacante.

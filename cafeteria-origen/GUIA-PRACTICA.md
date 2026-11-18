# Práctico de Ciberseguridad — Cafetería Origen

**Programación IV · Redes y Seguridad**

---

## 0. El contexto

Valentina abrió su cafetería de especialidad. Empezó anotando los pedidos en un
cuaderno, pero ya no da abasto: necesita una **API y un sitio web** para tomar
pedidos, ver la facturación y recibir reseñas.

Ese sitio **ya está developed y funcionando**. El problema es que lo périphieron
rápido, sin pensar en seguridad: hay datos de clientes, contraseñas de admins y
un servidor con acceso a la base de datos.

**Ustedes son el equipo de seguridad.** El trabajo es encontrar las fallas,
explicar por qué existen, corregirlas y demostrar que quedaron resueltas.

> La consigna del parcial (productos, pedidos, endpoints) ya está resuelta.
> Este práctico es **aparte**: la misma aplicación, pero dejada con problemas
> de seguridad de propósito.

---

## 1. Reglas de la práctica

Leé esto antes de tocar nada.

1. **Sólo contra la instalación local.** Todo se hace contra `localhost`.
   Probar estas técnicas en sistemas ajenos sin autorización es ilegal.
2. **Observar y defender, no automatizar.** No escribas scripts que automatiquen
   ataques (fuerza bruta, CSRF, etc.). La demostración es **manual, desde la
   interfaz**. Si una práctica pide "probar muchas contraseñas", las probás a mano.
3. **Reflexión.** Cada práctica termina con una respuesta breve: *¿qué habría
   que hacer distinto en un proyecto real para que esto no pasara?*
4. **No borres el historial.** Los pedidos y las reseñas que cree cada uno sirven
   para la demostración final.

---

## 2. Cómo levantar el proyecto

```bash
cd cafeteria-origen
docker compose up -d --build
```

- Sitio web → http://localhost:8080
- Panel → http://localhost:8080/admin.html

Usuarios para entrar al panel:

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin` | administrador |
| `valentina` | `origen2024` | administradora |
| `barista` | `cafe123` | barista |
| `mozo` | `mozo123` | mozo |
| `cliente` | `cliente` | cliente |

Tres herramientas que van a usar todo el tiempo:

```bash
docker compose exec app npm test                 # tests funcionales (el negocio)
docker compose exec app npm run test:seguridad    # batería de seguridad
docker compose exec app npm run check:security    # checklist de seguridad
```

**`npm test`** describe el **comportamiento del negocio** (precios, totales,
facturación). Tiene que quedar **en verde antes de tocar nada y en verde después**.

**`npm run test:seguridad`** es la **batería de seguridad** del práctico: una
tira de tests que comprueba que las fallas estén **corregidas**. Al empezar
está **en rojo** (el proyecto es vulnerable a propósito) y el objetivo es que
termine **en verde**. Cada test que falla te dice **qué comportamiento de
seguridad falta**; la parte difícil sigue siendo tuya: **encontrar dónde está
la falla y por qué ocurre**.

**`npm run check:security`** recorre el código con las planillas de seguridad del
apunte y dice qué controles faltan. Es un **análisis estático**: mira el
código, no ejecuta ataques. Sirve de apoyo, pero **no reemplaza la revisión
manual** ni a la batería.

### Cómo leer la batería de seguridad

```bash
docker compose exec app npm run test:seguridad
```

Está dividida en **8 bloques**, uno por tema del apunte:

| Bloque | Qué mide |
|---|---|
| Inyección SQL | Que no se pueda entrar sin contraseña, filtrar la base ni leer `password` |
| Cross-Site Scripting | Que el servidor y el cliente no devuelvan ni pinten HTML sin escapar |
| CSRF | Que exista token y que las operaciones que cambian estado lo exijan |
| Validación de entrada | Que se rechacen cantidades inválidas, textos sin límite y archivos peligrosos |
| Autenticación y sesiones | Hash, cookie, ID de sesión, logout, roles y escalada de privilegios |
| Inyección de comandos | Que lo que escribe el usuario no llegue a una consola |
| Configuración | Que no se filtren secretos, stack traces ni falten cabeceras de seguridad |
| Login y fuerza bruta | Que no se enumeren usuarios y que haya protección contra intentos repetidos |

Los mensajes de error son la **retroalimentación**: dicen qué falta, no dónde
está. Ejemplo:

```
not ok 5 - la cookie de sesión no tiene HttpOnly
```

Cuando un bloque pase entero, ese tema ya está resuelto: **seguí con el
siguiente**. Un bloque puede tener varios tests: si uno falla, el bloque
sigue en rojo hasta que passes todos.

> Los archivos `seguridad-login.test.ts` y `seguridad-fuerza-bruta.test.ts` están
> **separados a propósito**: el rate limiting cuenta los intentos fallidos y, si
> compartieran proceso con el resto, bloquearía la IP y rompería los demás
> tests. No los borres ni los juntes.

> **Ojo con la carpeta `uploads/`:** cuando corras la batería sobre el proyecto
> todavía vulnerable, el servidor va a **aceptar** el archivo `prueba.html` que
> manda el test (y a veces un `pwned-prueba.html` con rutaTraversal). Que
> aparezcan es la falla, no un error: cuando corrijas la validación de archivos,
> dejan de aparecer. (Ese archivo no se borra solo; si querés la carpeta
> limpia, borralo a mano.)

> La batería es **limpia**: borra los pedidos, las reseñas y los usuarios de
> prueba que crea, así que podés correrla sin miedo y después seguir usando la
> app con normalidad.

> **Un detalle de los tests funcionales:** si en algún momento creaste a mano
> un pedido con cantidad inválida (por ejemplo `-5` o `muchos`) aprovechándote
> de la falta de validación, ese pedido queda con total `NaN` y **envenena la
> facturación** (cualquier `SUM` de la base devuelve `NaN`). Por eso el test
> funcional de facturación lo tiene en cuenta. Para dejar la base como nueva:
> `docker compose down -v && docker compose up -d`.

---

## 3. Las cinco prácticas

Cada una sigue la estructura del apunte: **qué es → por qué ocurre → cómo
mitigarlo**.

### Práctica 1 — Inyección SQL

**Dónde mirar:** `src/services/usuarios.service.ts`, `catalogo.service.ts`,
`pedidos.service.ts`, `reportes.service.ts`.

**Cómo observarla (a mano):**

1. Entrá al panel con `admin` / `admin`.
2. En el login, en el campo de usuario escribí `' OR 1=1 --` y cualquier cosa en
   la contraseña. ¿Entrás? ¿Por qué?
3. En el menú, en el buscador escribí `' OR '1'='1`. ¿Qué devuelve?
4. En el panel → Reportes → "Ventas por origen", escribí `Brasil' UNION SELECT
   username, password, 1, 1 FROM usuarios--` y mirá qué devuelve.
5. Probá también con `'; DROP TABLE productos; --` **contra la base de pruebas** y
   observá qué pasa (después restaurá con `docker compose down -v && docker
   compose up -d`).

**Qué mirar en el código:** ¿dónde se mete lo que escribió el usuario dentro
de la consulta? ¿qué diferencia hay con lo que ya se hace en otros lados?

**Cómo se corrige:** consultas parametrizadas (`$1`, `$2`, ...) y listas blancas
de valores admitidos. Nada de concatenar.

**Cómo se verifica:** bloque *Inyección SQL* de `npm run test:seguridad` en verde.

---

### Práctica 2 — Cross-Site Scripting (XSS)

**Dónde mirar:** `src/public/js/app.js` y `src/public/js/admin.js`
(buscá `innerHTML`), y los mensajes de error de `src/routes/`.

**Cómo observarla (a mano):**

1. En el buscador del menú escribí `<img src=x onerror=alert('XSS')>` y confirmá
   que aparece el alert.
2. Publicá una reseña con `<script>alert('XSS almacenado')</script>` en el
   texto. Después **recargá** la página y mirá si salta sola. Ahora pedile a un
   compañero que abra el sitio: ¿a vos te aparece?
3. En el panel, abrí `admin.html?vista=<img src=x onerror=alert('DOM')>`.

**Qué mirar en el código:** ¿qué diferencia hay entre el texto que viene del
servidor y el que viene de la base? ¿qué función de JavaScript se usa para
insertarlo en la página?

**Cómo se corrige:** escapar al renderizar (`textContent` en vez de `innerHTML`),
validar el contenido en el servidor y agregar una **Content Security Policy**
como capa extra.

**Cómo se verifica:** bloque *Cross-Site Scripting* de `npm run test:seguridad`
en verde.

---

### Práctica 3 — Cross-Site Request Forgery (CSRF)

**Dónde mirar:** todos los formularios que cambian estado (`src/routes/`).

**Cómo observarla (a mano):**

1. Creá un archivo `ataque.html` en tu máquina:

   ```html
   <form method="POST" action="http://localhost:8080/api/pedidos">
     <input name="mesa" value="99">
     <input name="cliente" value="Atacante">
     <input name="items" value='[{"productoId":4,"cantidad":1}]'>
   </form>
   <script>document.forms[0].submit();</script>
   ```

2. Abrí el panel en una pestaña (sesión iniciada) y en otra abrí `ataque.html`.
   ¿Se creó el pedido sin que vos lo pidieras?

3. Repetí con el formulario de **cambio de contraseña** del panel.

**Qué mirar en el código:** ¿hay algún token en los formularios? ¿la cookie de
sesión tiene `SameSite`? ¿qué pasa si sólo con el POST alcanza?

**Cómo se corrige:** token anti-CSRF aleatorio por sesión (verificable en el
servidor) + `SameSite` en la cookie + verificación de `Origin`/`Referer`.

**Cómo se verifica:** bloque *CSRF* de `npm run test:seguridad` en verde.

---

### Práctica 4 — Validación de entrada débil

**Dónde mirar:** `src/services/pedidos.service.ts`, `src/routes/comentarios.routes.ts`,
`src/routes/admin.routes.ts`.

**Cómo observarla (a mano):**

1. En el formulario de pedido, en la cantidad escribí `-5`. Mirá el total que
   devuelve la API. ¿Tiene sentido?
2. En el devtools del navegador (F12), cambiá `type="number"` por `type="text"`
   en el campo de cantidad y mandá `"abc"`. ¿Qué acepta el servidor?
3. En el panel, subí un archivo `.html` (o un `.svg`) con un `<script>` dentro.
   Después abrilo en `/uploads/...`. ¿Qué pasa?
4. Publicá una reseña de 50.000 caracteres. El servidor la acepta tal cual.

**Qué mirar en el código:** ¿dónde se valida? ¿en el HTML o en el servidor?
**Nunca confíes en el cliente**: cualquier validación del navegador se puede
saltar con el devtools.

**Cómo se corrige:** validar **siempre en el servidor**: tipo, longitud, rango y
formato, con listas blancas. Para los archivos: extensión, MIME real y tamaño.

**Cómo se verifica:** bloque *Validación de entrada* de `npm run test:seguridad`
en verde.

---

### Práctica 5 — Autenticación insegura y gestión de sesiones

**Dónde mirar:** `src/routes/auth.routes.ts` y `src/middleware/sesion.ts`.

**Cómo observarla (a mano):**

1. Entrá con `admin` / `admin`. Son las **credenciales por defecto**.
2. Escribí un usuario inexistente (`fantasma`) y después un usuario existente con
   contraseña incorrecta. ¿Los mensajes son distintos? Eso permite **enumerar
   usuarios**.
3. Entrá al panel, abrí el devtools → Application → Cookies. Mirá la cookie `sid`:
   ¿tiene `HttpOnly`? ¿`Secure`? ¿`SameSite`? ¿El valor parece aleatorio?
4. Hacé login dos veces y compará los valores de la cookie. ¿Qué patrón siguen?
5. Entrá con el rol `cliente` (`cliente` / `cliente`) y fijate **qué podés
   hacer en el panel**. Después, desde ese mismo panel, cambiate el rol a
   `admin`. ¿Podés?
6. Abrí la terminal y hacé `docker compose exec db psql -U postgres -d origen
   -c "SELECT username, password FROM usuarios;"`. ¿Qué se ve?

**Qué mirar en el código:** ¿cómo se genera el identificador de sesión? ¿cuánto
dura? ¿el logout invalida algo del lado del servidor? ¿se verifica el rol?

**Cómo se corrige:** bcrypt con salt, mensajes genéricos, rate limiting,
cookies `HttpOnly` + `Secure` + `SameSite`, identificador aleatorio, expiración,
regeneración tras el login, cierre de sesión real y control de roles.

**Cómo se verifica:** bloques *Autenticación y sesiones* y *Login y fuerza bruta*
de `npm run test:seguridad` en verde.

---

### Práctica 6 (extra) — Inyección de comandos y exposición de información

**Dónde mirar:** `src/routes/admin.routes.ts` (endpoint "probar conexión") y
`src/routes/debug.routes.ts`.

**Cómo observarla (a mano):**

1. En el panel → Herramientas → "Probar conexión con el proveedor", escribí
   `127.0.0.1; cat /etc/hostname`. ¿Qué aparece en la salida?
2. En el navegador abrí `http://localhost:8080/api/_diagnostico`. ¿Qué datos
   se exponen? ¿Hace falta autenticación?
3. Provocá un error (por ejemplo, pedí un producto con un id raro) y mirá la
   respuesta JSON. ¿Trae el stack trace?

**Cómo se corrige:** `spawn()` con argumentos separados y `shell: false`, lista
blanca de servidores permitidos, proteger o eliminar el endpoint de diagnóstico
y responder con errores genéricos.

**Cómo se verifica:** bloques *Inyección de comandos* y *Configuración* de
`npm run test:seguridad` en verde.

---

## 4. Planillas de control

Antes de dar por terminado cada práctica, pasá por la planilla
correspondiente del apunte (se reprodujeron en `SOLUCIONES.md` para el docente)
y marcá **Sí / No / N/A**. El script `npm run check:security` cubre los ítems
críticos de esas planillas: usenlo como apoyo, pero **no reemplaza la
revisión manual del código**.

---

## 5. Qué hay que entregar

1. **Informe** (PDF o Markdown) con una sección por falla:
   - qué es y por qué importa,
   - **dónde está** (archivo y línea),
   - **cómo se observa** (pasos y evidencia),
   - **por qué ocurre**,
   - **cómo se corrige** (con el código de la corrección),
   - **cómo se verifica** que quedó resuelto.

2. **Código corregido** con el checklist en verde y la batería de seguridad en verde:

   ```bash
   docker compose exec app npm run check:security    # → ✔
   docker compose exec app npm run test:seguridad     # → todo verde
   docker compose exec app npm test                  # → todo verde
   ```

   Los dos primeros **arrancan en rojo** (es lo que hay que corregir) y el
   tercero tiene que estar en verde **antes y después**.

3. **Video de 5 a 8 minutos** (MP4 o link):
   - recorrida del código con las decisiones de diseño relevantes,
   - `npm test` en vivo en verde,
   - demo de la API corriendo con `curl` o Postman,
   - **cada integrante habla al menos una vez**.

4. **Reflexión final**: ¿qué cambiaron en su forma de pensar respecto de cómo
   se escribe una web app?

---

## 6. Estructura del proyecto

```
src/
├── app.ts                 # Express: middlewares y rutas
├── config.ts              # configuración
├── db.ts                  # conexión a PostgreSQL
├── catalogo.ts            # catálogo y cálculo de precios
├── inicializar.ts         # carga inicial de datos
├── tipos.ts               # tipos compartidos (filas de la base, sesión)
├── middleware/
│   ├── sesion.ts          # manejo de sesiones
│   ├── auth.ts            # requiereSesion / requiereRol
│   └── errores.ts         # manejo de errores
├── services/              # lógica de negocio (¡acá hay SQL!)
├── routes/                # endpoints REST
└── public/                # el sitio web (HTML + CSS + JS)
tests/                     # tests funcionales
│   ├── productos.test.ts
│   ├── pedidos.test.ts
│   ├── auth.test.ts
│   ├── reportes.test.ts
│   ├── seguridad.test.ts           # batería de seguridad
│   ├── seguridad-login.test.ts     # (aislada: usa el rate limiter)
│   └── seguridad-fuerza-bruta.test.ts
scripts/check-security.ts  # checklist de seguridad
```

Al terminar, la app tiene que seguir **haciendo lo mismo**: el menú, el carrito,
los pedidos, la facturación y las reseñas tienen que funcionar exactamente
igual que antes de empezar.

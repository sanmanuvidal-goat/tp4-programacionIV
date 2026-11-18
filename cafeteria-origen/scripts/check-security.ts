/**
 * =============================================================================
 * CHECKLIST DE SEGURIDAD EN CÓDIGO WEB — Cafetería Origen
 * =============================================================================
 *
 * Recorre el código del proyecto y evalúa, punto por punto, los ítems de las
 * planillas de seguridad del apunte "Redes y Seguridad" (OWASP Top 10).
 *
 *   npm run check:security
 *
 * Salida:
 *   ✔ PASA   el control está cubierto
 *   ✘ FALLA  el control se está violando
 *   ○ AVISO  control recomendado (no afecta la aprobación)
 *
 * El código de salida del proceso es 1 si falla algún control crítico.
 *
 * NOTA IMPORTANTE: este script NO explota nada. Sólo analiza el código
 * estáticamente, igual que las planillas de revisión del apunte.
 * =============================================================================
 */

import fs from 'fs';
import path from 'path';

const RAIZ = path.join(__dirname, '..');

/** Un ítem de la planilla de seguridad. */
interface Control {
  id: string;
  categoria: string;
  titulo: string;
  detalle: string;
  /** 'ausente': el patrón NO debe aparecer · 'presente': el patrón debe aparecer. */
  tipo: 'ausente' | 'presente';
  /** Archivos o carpetas (relativos a la raíz del proyecto) a revisar. */
  archivos: string[];
  patron: RegExp;
  /** Si el archivo coincide con esta expresión, se saltea. */
  excepcion?: RegExp;
  critico: boolean;
}

interface Hallazgo {
  archivo: string;
  linea: number;
  frase: string;
}

interface Resultado {
  ok: boolean;
  resumen: string;
  ejemplos: string[];
}

/* ============================== utilidades ============================== */

/**
 * Enmascara los comentarios (los reemplaza por espacios) sin alterar la
 * longitud del texto, para que las líneas reportadas sean las reales y la
 * documentación no se confunda con código ejecutable.
 */
function enmascararComentarios(texto: string): string {
  let salida = texto.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  salida = salida.replace(/(?<![:'"\w\/])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
  return salida;
}

/** Devuelve la lista de archivos de una ruta (archivo o carpeta). */
function listarArchivos(rel: string): string[] {
  const absoluto = path.join(RAIZ, rel);
  if (!fs.existsSync(absoluto)) return [];
  if (fs.statSync(absoluto).isFile()) return [absoluto];

  const salida: string[] = [];
  (function recorrer(dir: string) {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        if (entrada.name === 'node_modules') continue;
        recorrer(completo);
      } else if (/\.(ts|js|html|sql|yml|yaml)$/.test(entrada.name)) {
        salida.push(completo);
      }
    }
  })(absoluto);
  return salida;
}

/** Busca un patrón en un archivo y devuelve el primer hallazgo. */
function buscarEnArchivo(rutaAbsoluta: string, patron: RegExp): Hallazgo | null {
  const texto = enmascararComentarios(fs.readFileSync(rutaAbsoluta, 'utf8'));
  const m = patron.exec(texto);
  if (!m) return null;
  const linea = texto.slice(0, m.index).split(/\r?\n/).length;
  return {
    archivo: path.relative(RAIZ, rutaAbsoluta),
    linea,
    frase: m[0].replace(/\s+/g, ' ').trim().slice(0, 90),
  };
}

/* ============================== controles ============================== */

const CONTROLES: Control[] = [
  // -------------------------------------------------------------------------
  // 1. INYECCIÓN SQL
  // -------------------------------------------------------------------------
  {
    id: 'SQLI-01',
    categoria: 'Inyección SQL',
    titulo: 'Ninguna consulta SQL interpola la entrada del usuario',
    detalle:
      'No debe aparecer SQL con ${...} dentro. Usar consultas parametrizadas ($1, $2, ...) y valores por separado. ' +
      'Excepción: la lista de columnas de un UPDATE puede armarse con .join() si cada campo sale de una lista blanca.',
    tipo: 'ausente',
    archivos: ['src/services', 'src/routes'],
    // Las palabras clave van con \b para no confundir "AND" dentro de "randomUUID"
    // y la excepción de .join() cubre las listas de columnas con lista blanca.
    patron:
      /`[^`]*(?:\bSELECT|\bINSERT|\bUPDATE|\bDELETE|\bFROM|\bWHERE|\bVALUES|\bSET|\bAND|\bOR|\bLIKE|\bORDER BY|\bGROUP BY|\bLIMIT)[^`]*?(?<!\$)\$\{(?![^}]*\.join\()/i,
    critico: true,
  },
  {
    id: 'SQLI-02',
    categoria: 'Inyección SQL',
    titulo: 'La capa de servicios usa consultas parametrizadas',
    detalle: 'Deben existir consultas con marcadores posicionales ($1, $2, ...) en src/services.',
    tipo: 'presente',
    archivos: ['src/services'],
    patron: /\$\d/,
    critico: true,
  },
  {
    id: 'SQLI-03',
    categoria: 'Inyección SQL',
    titulo: 'La base de datos no acepta conexiones sin contraseña',
    detalle:
      'En docker-compose.yml no debe estar POSTGRES_HOST_AUTH_METHOD: trust (acepta cualquier conexión sin clave).',
    tipo: 'ausente',
    archivos: ['docker-compose.yml'],
    patron: /POSTGRES_HOST_AUTH_METHOD\s*:\s*trust/i,
    critico: true,
  },
  {
    id: 'SQLI-04',
    categoria: 'Inyección SQL',
    titulo: 'El puerto de la base de datos no está publicado al host',
    detalle:
      'La base sólo debe ser accesible desde la red interna de Docker. No publicar su puerto en "ports".',
    tipo: 'ausente',
    archivos: ['docker-compose.yml'],
    patron: /["']?\d{2,5}:5432["']?/,
    critico: true,
  },
  {
    id: 'SQLI-05',
    categoria: 'Inyección SQL',
    titulo: 'La aplicación no se conecta con el superusuario',
    detalle:
      'DB_USER no debe ser "postgres". Usar el usuario de aplicación con permisos reducidos (origen_app).',
    tipo: 'ausente',
    archivos: ['docker-compose.yml', 'src/config.ts'],
    patron: /DB_USER\s*[:=]\s*["']?postgres\b/i,
    critico: true,
  },

  // -------------------------------------------------------------------------
  // 2. CROSS-SITE SCRIPTING (XSS)
  // -------------------------------------------------------------------------
  {
    id: 'XSS-01',
    categoria: 'XSS',
    titulo: 'El cliente no inyecta datos con innerHTML',
    detalle:
      'Usar textContent / document.createElement en lugar de innerHTML. Si se usa una librería sanitizadora (DOMPurify), el innerHTML se acepta.',
    tipo: 'ausente',
    archivos: ['src/public/js'],
    patron: /\binnerHTML\b/,
    excepcion: /DOMPurify/i,
    critico: true,
  },
  {
    id: 'XSS-02',
    categoria: 'XSS',
    titulo: 'Los mensajes de error del servidor no reflejan la entrada',
    detalle:
      'Un mensaje de error que incluye lo que mandó el cliente es un vector de XSS reflejado. Usar mensajes genéricos.',
    tipo: 'ausente',
    archivos: ['src/routes', 'src/middleware'],
    patron: /error\s*:\s*`[^`]*\$\{/,
    critico: true,
  },
  {
    id: 'XSS-03',
    categoria: 'XSS',
    titulo: 'Hay una Content Security Policy configurada',
    detalle:
      'Configurar helmet con contentSecurityPolicy (script-src, object-src "none", etc.) como capa extra frente al XSS.',
    tipo: 'presente',
    archivos: ['src/app.ts'],
    patron: /contentSecurityPolicy/i,
    critico: true,
  },
  {
    id: 'XSS-04',
    categoria: 'XSS',
    titulo: 'El contenido enviado por el usuario se acota en el servidor',
    detalle:
      'El texto de las reseñas debe tener límite de longitud y control de formato antes de guardarlo.',
    tipo: 'presente',
    archivos: ['src/routes/comentarios.routes.ts', 'src/services/comentarios.service.ts'],
    patron: /longitud|maxlength|\.length|trim\s*\(|sanitiz|escap/i,
    critico: false,
  },

  // -------------------------------------------------------------------------
  // 3. CSRF
  // -------------------------------------------------------------------------
  {
    id: 'CSRF-01',
    categoria: 'CSRF',
    titulo: 'Existe un token anti-CSRF',
    detalle:
      'Generar un token aleatorio por sesión, incluirlo en los formularios y validarlo en el servidor (cabecera X-CSRF-Token o campo _csrf).',
    tipo: 'presente',
    archivos: ['src'],
    patron: /csrf/i,
    critico: true,
  },
  {
    id: 'CSRF-02',
    categoria: 'CSRF',
    titulo: 'La cookie de sesión usa SameSite',
    detalle: 'Configurar sameSite: "lax" (o "strict") en la cookie de sesión.',
    tipo: 'presente',
    archivos: ['src/middleware/sesion.ts', 'src/app.ts'],
    patron: /sameSite/i,
    critico: true,
  },
  {
    id: 'CSRF-03',
    categoria: 'CSRF',
    titulo: 'Se verifica el origen de las peticiones que cambian estado',
    detalle:
      'Comprobar la cabecera Origin o Referer de las peticiones POST/PUT/PATCH/DELETE.',
    tipo: 'presente',
    archivos: ['src'],
    patron: /['"]origin['"]|headers\.origin|referer/i,
    critico: false,
  },
  {
    id: 'CSRF-04',
    categoria: 'CSRF',
    titulo: 'Las operaciones que cambian estado no se hacen con GET',
    detalle: 'Usar POST / PUT / PATCH / DELETE para crear, modificar y borrar.',
    tipo: 'presente',
    archivos: ['src/routes'],
    patron: /router\.(post|put|patch|delete)\(/,
    critico: true,
  },

  // -------------------------------------------------------------------------
  // 4. VALIDACIÓN DE ENTRADA
  // -------------------------------------------------------------------------
  {
    id: 'VAL-01',
    categoria: 'Validación de entrada',
    titulo: 'Los ids de las rutas se validan como enteros',
    detalle:
      'Convertir y validar los parámetros de ruta (Number / parseInt + Number.isInteger) antes de usarlos.',
    tipo: 'presente',
    archivos: ['src/routes', 'src/validacion.ts'],
    patron: /Number\.isInteger|parseInt|Number\s*\(/,
    critico: true,
  },
  {
    id: 'VAL-02',
    categoria: 'Validación de entrada',
    titulo: 'Se validan tipo, longitud y rango de las entradas',
    detalle:
      'La validación tiene que estar en el servidor (no sólo en el HTML). Se recomienda un módulo src/validacion.ts con funciones de validación.',
    tipo: 'presente',
    archivos: ['src'],
    patron: /validac|validar|sanitiz/i,
    critico: true,
  },
  {
    id: 'VAL-03',
    categoria: 'Validación de entrada',
    titulo: 'Se usan listas blancas de valores permitidos',
    detalle:
      'Definir exactamente qué valores se aceptan (tipo de café, origen, estado del pedido, rol) en lugar de rechazar los prohibidos.',
    tipo: 'presente',
    archivos: ['src'],
    patron: /whitelist|lista blanca|permitidos|valoresValidos|ALLOWED|ENUM/i,
    critico: true,
  },
  {
    id: 'VAL-04',
    categoria: 'Validación de entrada',
    titulo: 'La carga de archivos valida la extensión',
    detalle:
      'Validar la extensión contra una lista blanca y comprobar el tipo MIME real del archivo.',
    tipo: 'presente',
    archivos: ['src/routes/admin.routes.ts'],
    patron: /extname|mime|extension|extensiones/i,
    critico: true,
  },
  {
    id: 'VAL-05',
    categoria: 'Validación de entrada',
    titulo: 'La carga de archivos limita el tamaño',
    detalle: 'Verificar el tamaño del archivo antes de escribirlo en disco.',
    tipo: 'presente',
    archivos: ['src/routes/admin.routes.ts'],
    patron: /statSync|\.size\s*[<>=]|\.length\s*[<>]|MAX_SIZE|TAMANO_MAX|SIZE_MAX|LIMITE_SIZE/i,
    critico: true,
  },
  {
    id: 'VAL-06',
    categoria: 'Validación de entrada',
    titulo: 'No se filtran stack traces al cliente',
    detalle:
      'El manejador de errores debe responder con un mensaje genérico y dejar el detalle real en el log del servidor.',
    tipo: 'ausente',
    archivos: ['src/middleware/errores.ts', 'src/app.ts'],
    patron: /stack\s*:\s*(err|error)\.stack/,
    critico: true,
  },

  // -------------------------------------------------------------------------
  // 5. AUTENTICACIÓN Y GESTIÓN DE SESIONES
  // -------------------------------------------------------------------------
  {
    id: 'AUTH-01',
    categoria: 'Autenticación y sesiones',
    titulo: 'Las contraseñas se hashean con bcrypt y salt',
    detalle: 'Usar bcryptjs (ya instalado) para hashear y comparar contraseñas. Nunca guardar el texto plano.',
    tipo: 'presente',
    archivos: ['src'],
    patron: /from\s+['"]bcryptjs['"]|require\(['"]bcryptjs['"]\)|bcrypt\./,
    critico: true,
  },
  {
    id: 'AUTH-02',
    categoria: 'Autenticación y sesiones',
    titulo: 'La carga inicial de usuarios hashea las contraseñas',
    detalle:
      'Los usuarios de ejemplo deben guardarse con la contraseña hasheada (bcrypt.hash) y no en texto plano.',
    tipo: 'presente',
    archivos: ['src/inicializar.ts'],
    patron: /bcrypt\.hash|hashSync|hashPassword/i,
    critico: true,
  },
  {
    id: 'AUTH-03',
    categoria: 'Autenticación y sesiones',
    titulo: 'El login compara la contraseña con bcrypt',
    detalle: 'Usar bcrypt.compare(contraseñaIngresada, hashGuardado).',
    tipo: 'presente',
    archivos: ['src/services/usuarios.service.ts'],
    patron: /compare\s*\(/,
    critico: true,
  },
  {
    id: 'AUTH-04',
    categoria: 'Autenticación y sesiones',
    titulo: 'Hay protección contra fuerza bruta',
    detalle:
      'Aplicar rate limiting con express-rate-limit (ya instalado) sobre el endpoint de login, con límite por IP y por cuenta.',
    tipo: 'presente',
    archivos: ['src'],
    patron: /express-rate-limit|rateLimit|rate_limit/i,
    critico: true,
  },
  {
    id: 'AUTH-05',
    categoria: 'Autenticación y sesiones',
    titulo: 'La cookie de sesión es HttpOnly',
    detalle: 'res.cookie("sid", id, { httpOnly: true, secure: true, sameSite: "lax", ... }).',
    tipo: 'presente',
    archivos: ['src/middleware/sesion.ts'],
    patron: /httpOnly/i,
    critico: true,
  },
  {
    id: 'AUTH-06',
    categoria: 'Autenticación y sesiones',
    titulo: 'La cookie de sesión es Secure y SameSite',
    detalle:
      'Agregar secure y sameSite a la configuración de la cookie. La bandera Secure puede activarse por entorno (por ejemplo secure: process.env.NODE_ENV === "production"), para que la demo local sobre HTTP siga funcionando.',
    tipo: 'presente',
    archivos: ['src/middleware/sesion.ts'],
    patron: /secure\s*:/i,
    critico: true,
  },
  {
    id: 'AUTH-07',
    categoria: 'Autenticación y sesiones',
    titulo: 'El identificador de sesión no es un contador',
    detalle:
      'Un id incremental (sesion_1, sesion_2...) se adivina al instante. Usar crypto.randomUUID() o crypto.randomBytes().',
    tipo: 'ausente',
    archivos: ['src/middleware/sesion.ts'],
    patron: /sesion_\$\{|contadorSesiones|session_\$\{/,
    critico: true,
  },
  {
    id: 'AUTH-08',
    categoria: 'Autenticación y sesiones',
    titulo: 'El identificador de sesión es aleatorio',
    detalle: 'Generar el id con crypto.randomUUID() o crypto.randomBytes().',
    tipo: 'presente',
    archivos: ['src/middleware/sesion.ts'],
    patron: /randomUUID|randomBytes/i,
    critico: true,
  },
  {
    id: 'AUTH-09',
    categoria: 'Autenticación y sesiones',
    titulo: 'Las sesiones tienen fecha de vencimiento',
    detalle: 'No dejar la expiración en null: definir un TTL (por inactividad y absoluto).',
    tipo: 'ausente',
    archivos: ['src/middleware/sesion.ts'],
    patron: /expiraEn\s*[:=]\s*null/i,
    critico: true,
  },
  {
    id: 'AUTH-10',
    categoria: 'Autenticación y sesiones',
    titulo: 'La expiración de la sesión está calculada',
    detalle: 'Calcular el vencimiento (Date.now() + TTL) y rechazar las sesiones vencidas.',
    tipo: 'presente',
    archivos: ['src/middleware/sesion.ts'],
    patron: /Date\.now\(\)\s*\+|TTL|TIEMPO_SESION|MAX_VIDA|maxAge/i,
    critico: true,
  },
  {
    id: 'AUTH-11',
    categoria: 'Autenticación y sesiones',
    titulo: 'El logout invalida la sesión en el servidor',
    detalle:
      'Al cerrar sesión hay que borrar la sesión del almacén del servidor, no sólo la cookie del navegador.',
    tipo: 'presente',
    archivos: ['src/routes/auth.routes.ts'],
    patron: /destruirSesion\s*\(|borrarSesion\s*\(|eliminarSesion\s*\(|sesiones\.delete\s*\(/,
    critico: true,
  },
  {
    id: 'AUTH-12',
    categoria: 'Autenticación y sesiones',
    titulo: 'Los mensajes de login son genéricos',
    detalle:
      'No distinguir entre "usuario inexistente" y "contraseña incorrecta": responder siempre lo mismo.',
    tipo: 'ausente',
    archivos: ['src/routes/auth.routes.ts'],
    patron: /no existe en el sistema|La contraseña es incorrecta|contraseña incorrecta/i,
    critico: true,
  },
  {
    id: 'AUTH-13',
    categoria: 'Autenticación y sesiones',
    titulo: 'No hay credenciales triviales de fábrica',
    detalle:
      'Las cuentas de ejemplo no deberían usar contraseñas triviales (admin/admin, cliente/cliente...) ni quedar activadas por defecto en producción.',
    tipo: 'ausente',
    archivos: ['src/inicializar.ts', 'src/config.ts'],
    patron: /password\s*:\s*['"](admin|cliente|barista|mozo|password|123456)['"]/i,
    critico: false,
  },
  {
    id: 'AUTH-14',
    categoria: 'Autenticación y sesiones',
    titulo: 'Las rutas de administración exigen el rol admin',
    detalle:
      'Aplicar requiereRol("admin") a las rutas de administración: si no, cualquiera autenticado (incluso con rol "cliente") entra al panel.',
    tipo: 'presente',
    archivos: ['src/routes/admin.routes.ts'],
    patron: /requiereRol\s*\(/,
    critico: true,
  },
  {
    id: 'AUTH-15',
    categoria: 'Autenticación y sesiones',
    titulo: 'El rol de un usuario no se acepta sin verificar',
    detalle:
      'La actualización de usuarios debe comprobar el rol de quien la pide antes de cambiar el campo "rol" (escalada de privilegios).',
    tipo: 'presente',
    archivos: ['src/routes/admin.routes.ts'],
    patron: /req\.usuario\.rol\s*===|req\.usuario\.rol\s*!==|ROLES_ADMIN|ADMIN_ROLES/i,
    critico: false,
  },

  // -------------------------------------------------------------------------
  // 6. INYECCIÓN DE COMANDOS
  // -------------------------------------------------------------------------
  {
    id: 'CMD-01',
    categoria: 'Inyección de comandos',
    titulo: 'No se ejecutan comandos con la entrada del usuario',
    detalle:
      'No usar child_process.exec() con datos del usuario: usar spawn() con argumentos separados y shell: false.',
    tipo: 'ausente',
    archivos: ['src'],
    patron: /\bexec\s*\(|shell\s*:\s*true/,
    critico: true,
  },
  {
    id: 'CMD-02',
    categoria: 'Inyección de comandos',
    titulo: 'El comando se ejecuta sin shell y con argumentos separados',
    detalle: 'Usar spawn("ping", ["-c", "3", host], { shell: false }).',
    tipo: 'presente',
    archivos: ['src/routes/admin.routes.ts'],
    patron: /spawn\s*\(|execFile\s*\(/,
    critico: true,
  },
  {
    id: 'CMD-03',
    categoria: 'Inyección de comandos',
    titulo: 'El host se valida contra una lista blanca',
    detalle:
      'Sólo se permite consultar a los servidores de proveedor conocidos: el resto se rechaza.',
    tipo: 'presente',
    archivos: ['src/routes/admin.routes.ts'],
    patron: /whitelist|lista blanca|permitidos|HOSTS|validos/i,
    critico: true,
  },

  // -------------------------------------------------------------------------
  // 7. AJUSTES DE CONFIGURACIÓN Y EXPOSICIÓN DE INFORMACIÓN
  // -------------------------------------------------------------------------
  {
    id: 'CFG-01',
    categoria: 'Configuración',
    titulo: 'Se usan cabeceras de seguridad (helmet)',
    detalle: 'helmet ya está instalado: app.use(helmet({ contentSecurityPolicy: {...} })).',
    tipo: 'presente',
    archivos: ['src/app.ts'],
    patron: /helmet/i,
    critico: true,
  },
  {
    id: 'CFG-02',
    categoria: 'Configuración',
    titulo: 'No hay secretos escritos en el código',
    detalle:
      'El secreto de sesión y la contraseña de la base deben venir de process.env, sin valores por defecto escritos a mano.',
    tipo: 'ausente',
    archivos: ['src/config.ts'],
    patron: /sessionSecret\s*:\s*['"]|\|\|\s*['"](postgres|origen123)['"]/,
    critico: true,
  },
  {
    id: 'CFG-03',
    categoria: 'Configuración',
    titulo: 'El endpoint de diagnóstico está protegido',
    detalle:
      '/api/_diagnostico no puede quedar abierto a cualquiera: debe exigir sesión (y rol admin) o eliminarse.',
    tipo: 'presente',
    archivos: ['src/routes/debug.routes.ts'],
    patron: /requiereSesion|requiereRol/,
    critico: true,
  },
  {
    id: 'CFG-04',
    categoria: 'Configuración',
    titulo: 'El diagnóstico no filtra variables de entorno',
    detalle: 'No devolver process.env completo ni credenciales en la respuesta.',
    tipo: 'ausente',
    archivos: ['src/routes/debug.routes.ts'],
    patron: /process\.env/,
    critico: true,
  },
  {
    id: 'CFG-05',
    categoria: 'Configuración',
    titulo: 'El contenedor no corre como root',
    detalle: 'Crear un usuario sin privilegios en el Dockerfile y usarlo con USER.',
    tipo: 'presente',
    archivos: ['Dockerfile'],
    patron: /^\s*USER\s+\w+/m,
    critico: false,
  },
];

/* ============================== evaluación ============================== */

function evaluar(control: Control): Resultado {
  const archivos = control.archivos.flatMap(listarArchivos);
  const hallazgos: Hallazgo[] = [];

  // Si el archivo a revisar no existe, el control NO puede darse por
  // cumplido: se reporta como falla para no dar un falso positivo.
  if (archivos.length === 0) {
    return {
      ok: false,
      resumen: `no se encontró ${control.archivos.join(', ')} para revisar`,
      ejemplos: [],
    };
  }

  for (const absoluto of archivos) {
    if (control.excepcion) {
      const textoCompleto = fs.readFileSync(absoluto, 'utf8');
      if (control.excepcion.test(textoCompleto)) continue;
    }
    const hallazgo = buscarEnArchivo(absoluto, control.patron);
    if (hallazgo) hallazgos.push(hallazgo);
  }

  if (control.tipo === 'ausente') {
    return {
      ok: hallazgos.length === 0,
      resumen: hallazgos.length
        ? 'se encontró en ' + hallazgos.map((h) => `${h.archivo}:${h.linea}`).join(', ')
        : '',
      ejemplos: hallazgos.slice(0, 3).map((h) => `${h.archivo}:${h.linea}  ${h.frase}`),
    };
  }

  return {
    ok: hallazgos.length > 0,
    resumen: hallazgos.length
      ? 'implementado en ' + hallazgos.map((h) => `${h.archivo}:${h.linea}`).join(', ')
      : 'no se encontró la implementación',
    ejemplos: [],
  };
}

/* ============================== salida ============================== */

function color(texto: string, codigo: string): string {
  return process.stdout.isTTY ? `\x1b[${codigo}m${texto}\x1b[0m` : texto;
}

function imprimir(): void {
  console.log('');
  console.log(color('  CHECKLIST DE SEGURIDAD — CAFETERÍA ORIGEN', '1;33'));
  console.log(color('  ────────────────────────────────────────────────────────────', '33'));
  console.log('');

  const categorias: string[] = [];
  for (const control of CONTROLES) {
    if (!categorias.includes(control.categoria)) categorias.push(control.categoria);
  }

  let criticosFallados = 0;
  let criticosTotales = 0;
  let avisos = 0;

  for (const categoria of categorias) {
    console.log(color(`  ${categoria.toUpperCase()}`, '1'));

    for (const control of CONTROLES.filter((c) => c.categoria === categoria)) {
      const r = evaluar(control);
      const icono = r.ok ? color('✔', '32') : control.critico ? color('✘', '31') : color('○', '33');

      if (control.critico) {
        criticosTotales += 1;
        if (!r.ok) criticosFallados += 1;
      } else if (!r.ok) {
        avisos += 1;
      }

      console.log(`    ${icono} ${control.id.padEnd(9)} ${control.titulo}`);

      if (!r.ok) {
        console.log(color(`               → ${r.resumen || control.detalle}`, '90'));
        r.ejemplos.forEach((e) => console.log(color(`                 ${e}`, '90')));
        console.log(color(`               Qué hacer: ${control.detalle}`, '90'));
      }
    }
    console.log('');
  }

  const aprobados = criticosTotales - criticosFallados;
  console.log(color('  ────────────────────────────────────────────────────────────', '33'));

  if (criticosFallados === 0) {
    console.log(color(`  ✔ Todos los controles críticos están cubiertos (${aprobados}/${criticosTotales}).`, '32'));
  } else {
    console.log(
      color(`  ✘ Faltan ${criticosFallados} control(es) crítico(s): ${aprobados}/${criticosTotales}.`, '31')
    );
  }
  if (avisos > 0) {
    console.log(color(`  ○ ${avisos} control(es) recomendado(s) pendientes.`, '33'));
  }
  console.log('');
  console.log(color('  Recordá: este script sólo analiza el código. No explotás nada,', '90'));
  console.log(color('  observás los síntomas desde la interfaz y recién ahí corregís.', '90'));
  console.log('');

  if (criticosFallados > 0) process.exitCode = 1;
}

imprimir();

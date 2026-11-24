import type { Request, Response } from 'express';
import crypto, { randomUUID } from 'node:crypto';
import type { Sesion, UsuarioSesion } from '../tipos';

export const sesiones = new Map<string, Sesion>();
const TTL_MS = 60 * 60 * 1000; // 1 hora

export function obtenerOCrearTokenCsrf(req: Request, res: Response): string {
  let sesion = obtenerSesion(req);

  if (!sesion) {
    const id = `invitado_${randomUUID()}`;
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const ahora = Date.now();
    sesion = {
      usuario: null as unknown as UsuarioSesion,
      creadaEn: ahora,
      expiraEn: ahora + TTL_MS,
      csrfToken,
    };
    sesiones.set(id, sesion);
    res.cookie('sid', id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: TTL_MS,
    });
    return csrfToken;
  }

  if (!sesion.csrfToken) {
    sesion.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  return sesion.csrfToken;
}

export function leerCookies(req: Request): Record<string, string> {
  const cookies: Record<string, string> = {};
  const header = req.headers.cookie;
  if (!header) return cookies;
  for (const parte of header.split(';')) {
    const separador = parte.indexOf('=');
    if (separador < 0) continue;
    const nombre = parte.slice(0, separador).trim();
    const valor = parte.slice(separador + 1).trim();
    if (nombre) cookies[nombre] = decodeURIComponent(valor);
  }
  return cookies;
}

export function crearSesion(req: Request, res: Response, usuario: UsuarioSesion): string {
  const cookiesPrevias = leerCookies(req);
  if (cookiesPrevias.sid) {
    sesiones.delete(cookiesPrevias.sid);
  }

  const id = randomUUID();
  const ahora = Date.now();

  sesiones.set(id, {
    usuario,
    creadaEn: ahora,
    expiraEn: ahora + TTL_MS,
    csrfToken: crypto.randomBytes(32).toString('hex'),
  });

  res.cookie('sid', id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TTL_MS,
  });

  return id;
}

export function obtenerSesion(req: Request): Sesion | null {
  const cookies = leerCookies(req);
  const id = cookies.sid;
  if (!id) return null;

  const sesion = sesiones.get(id);
  if (!sesion) return null;

  if (sesion.expiraEn !== null && Date.now() > sesion.expiraEn) {
    sesiones.delete(id);
    return null;
  }

  return sesion;
}

export function destruirSesion(req: Request): void {
  const cookies = leerCookies(req);
  const id = cookies.sid;
  if (id) sesiones.delete(id);
}
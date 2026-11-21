import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

import type { Sesion, UsuarioSesion } from '../tipos';

export const sesiones = new Map<string, Sesion>();
const TTL_MS = 60 * 60 * 1000; // 1 hora

/** Lee las cookies de la petición (parser mínimo, sin dependencias). */
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

/** Crea una sesión nueva para el usuario y setea la cookie (regenerando ID si había sesión previa). */
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

/** Devuelve la sesión de la petición, si existe y no expiró. */
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

/** Cierra la sesión en el servidor. */
export function destruirSesion(req: Request): void {
  const cookies = leerCookies(req);
  const id = cookies.sid;
  if (id) sesiones.delete(id);
}
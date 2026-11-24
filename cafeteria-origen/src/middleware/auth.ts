import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { obtenerSesion } from './sesion';
import type { Rol } from '../tipos';

/**
 * Middlewares de autenticación y autorización.
 *
 * `requiereRol` está IMPLEMENTADO, pero OJO: en las rutas de administración
 * (src/routes/admin.routes.ts) NO se usa. Eso es una falla de autorización:
 * cualquier usuario autenticado —incluso uno con rol "cliente"— puede
 * crear/borrar productos, cambiar contraseñas o ejecutar comandos.
 */

/** Exige que haya una sesión válida. */
export function requiereSesion(req: Request, res: Response, next: NextFunction) {
  const sesion = obtenerSesion(req);
  if (!sesion || !sesion.usuario) {
    return res.status(401).json({ error: 'Necesitás iniciar sesión.' });
  }
  req.usuario = sesion.usuario;
  req.sesion = sesion;
  next();
}

/** Exige que el usuario autenticado tenga uno de los roles indicados. */
export function requiereRol(...roles: Rol[]): RequestHandler {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Necesitás iniciar sesión.' });
    }
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tenés permisos para esta operación.' });
    }
    next();
  };
}

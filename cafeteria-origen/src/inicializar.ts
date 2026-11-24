import * as db from './db';
import { CATALOGO } from './catalogo';
import type { Rol } from './tipos';
import bcrypt from 'bcryptjs';

interface UsuarioInicial {
  username: string;
  password: string;
  rol: Rol;
  nombre: string;
}

/**
 * Carga los datos iniciales (usuarios y catálogo) si la base está vacía.
 */
export const USUARIOS_INICIALES: UsuarioInicial[] = [
  {
    username: 'admin',
    password: 'admin',
    rol: 'admin',
    nombre: 'Administración',
  },
  {
    username: 'valentina',
    password: 'origen2024',
    rol: 'admin',
    nombre: 'Valentina',
  },
  {
    username: 'barista',
    password: 'cafe123',
    rol: 'barista',
    nombre: 'Barista',
  },
  {
    username: 'mozo',
    password: 'mozo123',
    rol: 'mozo',
    nombre: 'Mozo de sala',
  },
  {
    username: 'cliente',
    password: 'cliente',
    rol: 'cliente',
    nombre: 'Cliente',
  },
];

export async function inicializarBase(): Promise<void> {
  // --- Usuarios -------------------------------------------------------------
  for (const usuario of USUARIOS_INICIALES) {
    const passwordHash = await bcrypt.hash(usuario.password, 10);
    await db.query(
      `INSERT INTO usuarios (username, password, rol, nombre)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE
       SET password = EXCLUDED.password
       WHERE usuarios.password NOT LIKE '$2%'`,
      [usuario.username, passwordHash, usuario.rol, usuario.nombre]
    );
  }

  // --- Catálogo -------------------------------------------------------------
  for (const producto of CATALOGO) {
    await db.query(
      `INSERT INTO productos
         (nombre, tipo, variedad, tamano, gramos, precio_base, precio_por_gramo, descripcion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (nombre) DO NOTHING`,
      [
        producto.nombre,
        producto.tipo,
        producto.variedad,
        producto.tamano,
        producto.gramos,
        producto.precio_base,
        producto.precio_por_gramo,
        producto.descripcion,
      ]
    );
  }
}
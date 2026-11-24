import express from 'express';
import * as comentarios from '../services/comentarios.service';
import { requiereSesion, requiereRol } from '../middleware/auth';
import { validarTexto, validarEnteroEnRango, validarId } from '../validacion'

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json({ comentarios: await comentarios.listar() });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { autor, texto, calificacion } = req.body || {};

    const autorValido = validarTexto(autor, 1, 80);
    if (!autorValido) {
      return res.status(400).json({ error: 'El autor debe tener entre 1 y 80 caracteres.' });
    }

    const textoValido = validarTexto(texto, 1, 500);
    if (!textoValido) {
      return res.status(400).json({ error: 'La reseña debe tener entre 1 y 500 caracteres.' });
    }

    const califValida = validarEnteroEnRango(calificacion, 1, 5);
    if (califValida === null) {
      return res.status(400).json({ error: 'La calificación debe ser un entero entre 1 y 5.' });
    }

    const comentario = await comentarios.crear({
      autor: autorValido,
      texto: textoValido,
      calificacion: califValida,
    });
    res.status(201).json(comentario);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requiereSesion, requiereRol('admin'), async (req, res, next) => {
  try {
    const id = validarId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de comentario inválido.' });
    }

    const comentario = await comentarios.eliminar(id);
    if (!comentario) {
      return res.status(404).json({ error: 'Comentario no encontrado.' });
    }
    res.json(comentario);
  } catch (err) {
    next(err);
  }
});

export default router;
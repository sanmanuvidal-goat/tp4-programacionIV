import app from './app';
import config from './config';
import { inicializarBase } from './inicializar';

export async function arrancar(): Promise<void> {
  try {
    await inicializarBase();
    console.log('[origen] datos iniciales verificados en la base de datos');
  } catch (err) {
    console.error('[origen] no se pudieron cargar los datos iniciales:', (err as Error).message);
  }

  app.listen(config.port, () => {
    // Puerto publicado en el host (docker-compose.yml). Fuera de Docker el
    // puerto real es el de la app; dentro del contenedor se usa APP_PORT.
    const puertoHost = process.env.APP_PORT || config.port;
    console.log(`[origen] Cafetería Origen escuchando en http://localhost:${puertoHost}`);
    console.log(`[origen] panel de administración: http://localhost:${puertoHost}/admin.html`);
  });
}

arrancar();

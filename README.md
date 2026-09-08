# PlayX

PlayX es un **provider de fuentes** (source provider) para [Nuvio](https://nuvio.tv), la app media de código abierto. Dado un identificador de película o serie (TMDb Id), resuelve un flujo de reproducción **HLS nativo** (`m3u8`) y lo devuelve al player interno de Nuvio para reproducción directa.

Está pensado como un componente técnico de referencia: muestra cómo un provider puede resolver un `m3u8` real a partir de un `TMDbId`, sin depender del navegador externo del dispositivo.

## Características

- `movie` ✓ y `tv` ✓ (cada episodio se resuelve por temporada/episodio).
- Contenido en **español**, priorizando audio latino cuando está disponible.
- Resolución de cadena completa hasta **HLS nativo** (`m3u8`), reproducido en el player interno (sin navegador externo).
- **Un solo stream por título**: elige el mejor idioma (latino primero) y, dentro de él, la mayor resolución detectada en el master (1080p / 720p / …).
- Catálogo completo: resuelve cualquier `TMDbId` del catálogo, no solo destacados, usando los índices del sitio.

## Instalación

1. En Nuvio: **Repos / Providers → Fetch Manifest**
2. Pegá la raw URL de `manifest.json` de este repo.
3. Habilita **PlayX**.

## Uso interno

```js
const { getStreams } = require("./providers/playx");
const streams = await getStreams(tmdbId, mediaType, season, episode);
// → [{ name, title, url(m3u8), quality, headers }]
```

## Build local

```bash
npm install
npm run build        # node build.js playx
```

El bundle sale en `providers/playx.js`.

## Aviso legal

Este proyecto es una herramienta técnica de integración entre Nuvio y sitios de streaming de terceros. No aloja, sube ni distribuye contenido audiovisual propio: **resuelve URLs de reproducción** que los sitios expongan públicamente.

> Usá este software únicamente con contenido para el que tengas los derechos correspondientes, y respetá las leyes de propiedad intelectual de tu jurisdicción. El autor no es responsable del uso que terceros hagan del proyecto.

## Licencia

MIT — ver [LICENSE](LICENSE).

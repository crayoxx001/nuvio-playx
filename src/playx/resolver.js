/**
 * Resolver: encuentra la URL de detalle del contenido a partir del
 * TMDb id que Nuvio entrega.
 * Estrategia (sin API keys): el sitio indexa las pelis con URL
 *   /pelicula/<TMDbId>/<slug> / /serie/<TMDbId>/<slug>
 * Escaneamos las secciones de listado buscando una coincidencia exacta del id.
 */

import { fetchText, ORIGIN } from "./http.js";

const BASE = ORIGIN;

// secciones de listado de donde sacar <a href="/pelicula|serie/<id>/<slug>">
const SECTIONS = [
  "/peliculas/estrenos",
  "/peliculas",
  "/peliculas/tendencias/dia",
  "/peliculas/tendencias/semana",
  "/series/estrenos",
  "/series",
];

function extractDetailUrl(html, id, mediaType) {
  // match exacto del id en el patron de URL del tipo pedido
  const re = new RegExp(
    `<a href="/(pelicula|serie)/${id}/[^"]+"`,
    "g"
  );
  const found = new Set();
  let m;
  while ((m = re.exec(html))) {
    found.add(m[1]);
  }
  if (mediaType === "tv") return found.has("serie") ? pick(html, id, "serie") : null;
  return pick(html, id, "pelicula") || null;
}

function pick(html, id, type) {
  const m = html.match(
    `<a href="/${type}/${id}/[^"]+"`
  );
  return m ? BASE + m[0].replace('href="', "").replace(/"\s*$/, "") : null;
}

export async function resolveUrl(tmdbId, mediaType) {
  const type = mediaType === "tv" ? "serie" : "pelicula";
  for (const section of SECTIONS) {
    try {
      const html = await fetchText(BASE + section);
      const m = html.match(
        new RegExp(`<a href="/(${type})/${tmdbId}/[^"]+"`)
      );
      if (m) {
        const href = m[0].match(/href="([^"]+)"/)[1];
        return BASE + href;
      }
    } catch (_) {
      /* seccion caida o bloqueada: seguir */
    }
  }
  return null;
}

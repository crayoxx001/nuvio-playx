/**
 * Resolver: encuentra la URL (de peli o de episodio) a partir del TMDb id
 * que Nuvio entrega.
 *
 * movie: el sitio indexa las pelis con /pelicula/<TMDbId>/<slug>.
 * tv   : la serie es /serie/<TMDbId>/<slug> y cada capitulo cuelga de
 *        /serie/<id>/<slug>/temporada/<S>/episodio/<E>.
 * Escaneamos las secciones de listado buscando el id exacto, sacamos el
 * slug/base, y para tv ensamblamos la URL del capitulo pedido.
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

// devuelve la base /serie|pelicula/<id>/<slug> si el id aparece en la seccion
function findBase(html, id, type) {
  const m = html.match(new RegExp(`<a href="/(${type})/${id}/[^"]+"`));
  if (!m) return null;
  const href = m[0].match(/href="([^"]+)"/)[1];
  // cortar en el slug (puede venir degradado con /temporada/...)
  return href.split("/temporada/")[0];
}

export async function resolveUrl(tmdbId, mediaType, season, episode) {
  const type = mediaType === "tv" ? "serie" : "pelicula";
  let base = null;
  for (const section of SECTIONS) {
    try {
      const html = await fetchText(BASE + section);
      base = findBase(html, tmdbId, type);
      if (base) break;
    } catch (_) {
      /* seccion caida o bloqueada: seguir */
    }
  }
  if (!base) return null;
  // en series agregamos el capitulo pedido
  if (mediaType === "tv") {
    const s = season || 1;
    const e = episode || 1;
    return BASE + base + `/temporada/${s}/episodio/${e}`;
  }
  return BASE + base;
}

import { fetchText, ORIGIN } from "./http.js";

const BASE = ORIGIN;

// Secciones de listado (rapido, cubren los destacados/recientes). Claves
// concretas no sensibles.
const SECTIONS = [
  "/peliculas/estrenos",
  "/peliculas",
  "/peliculas/tendencias/dia",
  "/peliculas/tendencias/semana",
  "/series/estrenos",
  "/series",
];

const SM_MOVIES = `${BASE}/sitemap/movies.xml`;
const SM_SERIES = `${BASE}/sitemap/series.xml`;

function findBase(html, id, type) {
  const m = html.match(new RegExp(`<a href="/(${type})/${id}/[^"]+"`));
  if (!m) return null;
  const href = m[0].match(/href="([^"]+)"/)[1];
  return href.split("/temporada/")[0];
}

async function extractChunkLocations(indexXml) {
  const re = /<loc>([^<]+)<\/loc>/g;
  const out = [];
  let m;
  while ((m = re.exec(indexXml))) out.push(m[1].trim());
  return out;
}

function matchChunk(html, id, type) {
  const hit = html.match(new RegExp(`/(${type})/${id}/[^<" ]*`));
  if (!hit) return null;
  return hit[0];
}

// Búsqueda en el sitemap con parada temprana: lanzamos todos los subchunks en
// paralelo y resolvemos apenas el primer match por id aparece. Los chunks que
// siguen en vuelo se ignoran. Para series hay pocos chunks; para peliculas ~19.
async function findInSitemap(id, type, mediaType) {
  const indexXml = await fetchText(mediaType === "tv" ? SM_SERIES : SM_MOVIES);
  const subLocs = await extractChunkLocations(indexXml);
  if (subLocs.length === 0) return null;

  return await new Promise((resolve) => {
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      resolve(r);
    };
    let settled = 0;
    for (const loc of subLocs) {
      fetchText(loc)
        .then((html) => {
          const path = matchChunk(html, id, type);
          if (path) finish(path);
        })
        .catch(() => {})
        .finally(() => {
          settled++;
          if (settled === subLocs.length) finish(null);
        });
    }
    // safety: resolver si todos terminaron
  });
}

export async function resolveUrl(tmdbId, mediaType, season, episode) {
  const type = mediaType === "tv" ? "serie" : "pelicula";
  let base = null;

  // 1) rápido: secciones de listado (destacados/recientes)
  for (const section of SECTIONS) {
    try {
      const html = await fetchText(BASE + section);
      base = findBase(html, tmdbId, type);
      if (base) break;
    } catch (_) {}
  }

  // 2) fallback universal: sitemap completo → cualquier id que exista en el
  //    sitio, sin necesidad del título.
  if (!base) {
    const path = await findInSitemap(tmdbId, type, mediaType);
    if (path) base = "/" + path.split("/").slice(1, 4).join("/");
  }

  if (!base) return null;
  if (mediaType === "tv") {
    const s = season || 1;
    const e = episode || 1;
    return BASE + base + `/temporada/${s}/episodio/${e}`;
  }
  return BASE + base;
}

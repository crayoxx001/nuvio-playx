/**
 * Nuvio provider - main entry.
 * Nuvio llama a getStreams(tmdbId, mediaType, season, episode).
 * Soporta peliculas y series.
 *
 * El sitio no expone mp4/m3u8 en el listado: sus links van a un player
 * redirector (player.php?h=...) que deriva a un embed de StreamWish donde el
 * m3u8 real viene ofuscado en un script P.A.C.K.E.R. de doble capa.
 *
 * Este provider resuelve esa cadena a un .m3u8 absoluto (ver hls.js) y lo
 * devuelve como URL de stream, por lo que el player interno de Nuvio lo
 * reproduce nativamente (HLS).
 *
 * Politica de salida: UN solo stream por titulo. Se elige el mejor idioma
 * (espanol latino primero) y, dentro de el, el server con la mayor resolucion
 * detectada en su master. Los servers de hosters no soportados (vidhide, voe,
 * doodstream) o cuyos tokens esten rotos se descartan.
 */

import { resolveUrl } from "./resolver.js";
import { extractStreams } from "./extractor.js";
import { ORIGIN, fetchText } from "./http.js";
import { resolveHls, inspectMaster } from "./hls.js";

// orden de preferencia de idiomas (el usuario quiere latino/proximo)
const LANG_REGEX = [
  /latino/i,
  /hispano/i,
  /castellano/i,
  /espa/i,
  /subtitu/i,
];
function langRank(label) {
  for (let i = 0; i < LANG_REGEX.length; i++) {
    if (LANG_REGEX[i].test(label)) return i;
  }
  return 99; // ingles u otro: ultimo recurso
}

function qualityLabel(h) {
  if (!h) return "HD";
  if (h >= 2160) return "4K";
  if (h >= 1440) return "1440p";
  if (h >= 1080) return "1080p";
  if (h >= 720) return "720p";
  return h + "p";
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const detailUrl = await resolveUrl(tmdbId, mediaType, season, episode);
    if (!detailUrl) return [];

    const { servers } = await extractStreams(detailUrl);
    if (!servers || servers.length === 0) return [];

    // Resolvemos cada server (pidiendo su m3u8 + resolucion del master).
    // Los hosters no soportados o con token roto devuelven null y se omiten.
    const resolved = [];
    for (const s of servers) {
      try {
        const hls = await resolveHls(s.url, fetchText);
        if (!hls) continue;
        const h = await inspectMaster(hls, fetchText);
        resolved.push({
          lang: s.lang,
          rank: langRank(s.lang),
          server: s.server,
          height: h,
          url: hls,
        });
      } catch (e) {
        /* server sin resolver, se omite */
      }
    }
    if (resolved.length === 0) return [];

    // mejor idioma (menor rank). si hay empate de idioma, mayor resolucion.
    const bestRank = Math.min(...resolved.map((r) => r.rank));
    const inLang = resolved.filter((r) => r.rank === bestRank);
    inLang.sort((a, b) => (b.height || 0) - (a.height || 0));
    const best = inLang[0];

    const q = qualityLabel(best.height);
    return [
      {
        name: `Play` + `X`,
        title: `${best.lang} · ${q}${best.server && best.server !== "server" ? " · " + best.server : ""}`,
        url: best.url,
        quality: q,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36",
          Referer: ORIGIN + "/",
        },
      },
    ];
  } catch (e) {
    console.error(`[provider] Error: ${e.message}`);
    return [];
  }
}

module.exports = { getStreams };

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
 */

import { resolveUrl } from "./resolver.js";
import { extractStreams } from "./extractor.js";
import { ORIGIN, fetchText } from "./http.js";
import { resolveHls } from "./hls.js";

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const detailUrl = await resolveUrl(tmdbId, mediaType, season, episode);
    if (!detailUrl) return [];

    const { servers } = await extractStreams(detailUrl);

    // Resolvemos cada server a su m3u8 real. Quien falle se descarta (el
    // hoster pudo cambiar el espejo/ahud).
    const out = [];
    for (const s of servers) {
      try {
        const hls = await resolveHls(s.url, fetchText);
        if (!hls) continue;
        out.push({
          name: `Play` + `X`,
          title: `${s.lang} · ${s.server} · ${s.calidad}`,
          url: hls,
          quality: s.calidad,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36",
            Referer: ORIGIN + "/",
          },
        });
      } catch (e) {
        /* server sin resolver, se omite */
      }
    }
    return out;
  } catch (e) {
    console.error(`[provider] Error: ${e.message}`);
    return [];
  }
}

module.exports = { getStreams };

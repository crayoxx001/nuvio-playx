/**
 * Nuvio provider - main entry.
 * Nuvio llama a getStreams(tmdbId, mediaType, season, episode).
 * Soporta peliculas y series.
 *
 * El sitio no expone URLs de video directas (mp4/m3u8): sus links de
 * reproduccion apuntan a un player redirector que deriva a embeds de
 * hosters con anti-bot (streamwish/vidhide/voe/doodstream). Por eso este
 * provider devuelve esas URLs marcadas para abrirse en el NAVEGADOR EXTERNO
 * del dispositivo (supportsExternalPlayer), donde el player del hoster se
 * renderiza y el usuario pasa el captcha con un toque.
 */

import { resolveUrl } from "./resolver.js";
import { extractStreams } from "./extractor.js";
import { ORIGIN } from "./http.js";

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const detailUrl = await resolveUrl(tmdbId, mediaType, season, episode);
    if (!detailUrl) return [];

    const { servers } = await extractStreams(detailUrl);

    return servers.map((s, i) => ({
      name: `Play` + `X`,
      title: `${s.server} · ${s.calidad}`,
      url: s.url,
      quality: s.calidad,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36",
        Referer: ORIGIN + "/",
      },
      // se abre en navegador externo: hosters tienen anti-bot propio
      supportsExternalPlayer: true,
    }));
  } catch (e) {
    console.error(`[provider] Error: ${e.message}`);
    return [];
  }
}

module.exports = { getStreams };

/**
 * Extractor: dado el HTML de una pagina de detalle, saca las URLs de los
 * servidores de reproduccion (li.clili > data-tr). Se abren en navegador
 * externo (supportsExternalPlayer); el sitio no expone mp4/m3u8 directo.
 */

import { fetchText, HOST } from "./http.js";

export function parseServerLinks(html) {
  // cada server: <li class="clili ..." data-tr="https://player.../player.php?h=...">
  const out = [];
  const re =
    /<li class="clili[^"]*"[^>]*data-tr="(https:\/\/[^"]+)"[^>]*><span class="cdtr"><span>([^<]*)<!-- -->[.\s]*<!-- -->\s*([a-z0-9]+)\s*<!-- -->\s*-\s*<!-- -->\s*([A-Za-z0-9]+)<\/span>/g;
  let m;
  while ((m = re.exec(html))) {
    out.push({
      server: m[3].trim(),
      calidad: m[4].trim(),
      url: m[1],
    });
  }
  // si el patron estricto fallo, caida a data-tr pelado
  if (out.length === 0) {
    const playerHost = "player." + HOST;
    const reLoose = new RegExp(
      `data-tr="(https:\\/\\/${playerHost.replace(/\./g, "\\.")}\\/player\\.php\\?h=[^"]+)"`,
      "g"
    );
    let mm;
    while ((mm = reLoose.exec(html))) {
      out.push({ server: "server", calidad: "HD", url: mm[1] });
    }
  }
  return out;
}

export async function extractStreams(url) {
  const html = await fetchText(url);
  const servers = parseServerLinks(html);
  return {
    url,
    servers,
  };
}

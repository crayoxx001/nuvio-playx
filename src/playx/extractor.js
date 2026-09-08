/**
 * Extractor: dado el HTML de una pagina de detalle (peli o episodio), saca los
 * servidores de reproduccion agrupados por idioma.
 *
 * Estructura del sitio: hay bloques por idioma, cada uno
 *   <div class="_1R6bW_0"><span>ESPANOL LATINO <span> CALIDAD HD </span></span></div>
 *   <ul class="sub-tab-lang ..."><li class="clili" data-tr="https://player.../player.php?h=...">
 *
 * El idioma vive en el label del bloque, no en el <li>. Nos quedamos con
 * latino/hispano prioritario; si no hay, caemos al resto en espanol. Se abren
 * en navegador externo (supportsExternalPlayer).
 */

import { fetchText } from "./http.js";

// orden de preferencia de idiomas (el usuario quiere latino)
const LANG_RANK = [
  /latino/i,
  /hispano/i,
  /castellano/i,
  /espa/i,
  /subtitu/i,
];

function rankLabel(label) {
  for (let i = 0; i < LANG_RANK.length; i++) {
    if (LANG_RANK[i].test(label)) return i;
  }
  return 99; // ingles u otro: va al final, solo si no hay espanol
}

// extrae los li.clili de un bloque <ul> dado
function parseBlockServers(block) {
  const out = [];
  const re =
    /<li class="clili[^"]*"[^>]*data-tr="(https:\/\/[^\"]+)"[^>]*><span class="cdtr"><span>([^<]*)<!-- -->[.\s]*<!-- -->\s*([a-z0-9]+)\s*<!-- -->\s*-\s*<!-- -->\s*([A-Za-z0-9]+)<\/span>/g;
  let m;
  while ((m = re.exec(block))) {
    out.push({ server: m[3].trim(), calidad: m[4].trim(), url: m[1] });
  }
  // caida a data-tr pelado si el patron estricto fallo
  if (out.length === 0) {
    const m2 = block.match(/data-tr="(https:\/\/[^\"]+)"/g);
    if (m2) {
      for (const mt of m2) {
        out.push({ server: "server", calidad: "HD", url: mt.replace(/data-tr="/, "").replace(/"\s*$/, "") });
      }
    }
  }
  return out;
}

export function parseServerLinks(html) {
  // cada bloque de idioma: label + su lista de servers
  const blockRe =
    /<div class="_1R6bW_0"><span>([^<]*?)\s*(?:<span>.*?<\/span>)?\s*<\/span><\/div><\/div><div><ul class="sub-tab-lang.*?<\/ul>/gi;
  const groups = [];
  let b;
  while ((b = blockRe.exec(html))) {
    const label = b[1].replace(/<[^>]+>/g, "").trim() || "Español";
    groups.push({ lang: label, rank: rankLabel(label), servers: parseBlockServers(b[0]) });
  }

  // si no matcheo por bloques, caida: todos los data-tr sueltos sin idioma
  if (groups.length === 0) {
    const all = parseBlockServers(html);
    return all.map((s) => ({ ...s, lang: "esp" }));
  }

  // ordenar por preferencia de idioma y devolver aplanado
  groups.sort((a, b) => a.rank - b.rank);
  const out = [];
  for (const g of groups) {
    for (const s of g.servers) out.push({ ...s, lang: g.lang });
  }
  return out;
}

export async function extractStreams(url) {
  const html = await fetchText(url);
  return { url, servers: parseServerLinks(html) };
}

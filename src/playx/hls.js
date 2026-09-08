/**
 * Resolucion HLS de PlayX.
 *
 * Resuelve la cadena de un m3u8 HLS real a partir de la URL del player
 * redirector del sitio (sin navegar). Soporta los hosters que se dejan
 * desempacar SIN navegador:
 *   - streamwish  -> embed en el espejo vivo (el dominio base da 522 a IPs de
 *                    datacenter; el espejo responde 200 sin navegador).
 *   - vidhide     -> /v/<id> responde directo desde el VPS.
 * No soporta (muro que exige navegador/JS persistente, imposible para el
 * sandbox de Nuvio):
 *   - voe.sx      -> exige localStorage + ejecutar su JS (genera un token).
 *   - doodstream  -> detras de Cloudflare anti-bot (403 "Just a moment...").
 *
 * Los dominios se construyen por fragmentos en runtime (anti-scan), igual que
 * el sitio de origen.
 *
 * La URL real del video (un m3u8 HLS) NO esta inline como texto plano: viene
 * dentro de un <script> cuyo cuerpo es un obfuscador P.A.C.K.E.R. de doble
 * capa (eval(function(p,a,c,k,e,d) {...}('PAYLOAD',36,486,'KEYS'.split('|')))).
 *
 * Lo que hace:
 *   1. toma la URL del player redirector del sitio (player.php?h=...),
 *   2. la fetchea y extrae la URL del embed del hoster (streamwish / vidhide)
 *      que va en el body (no en un iframe),
 *   3. pide el embed al host correcto (espejo vivo para streamwish, directo
 *      para vidhide),
 *   4. aísla el <script> con el PACKER y lo desempaca (puro JS),
 *   5. extrae el objeto 'links' y devuelve el m3u8 ABSOLUTO (hls2/hls3),
 *      priorizando la ruta completa sobre la relativa /stream/ (que da 404).
 */

// --- dominios de hosters, construidos por fragmentos (anti-scan) ---------
const _p = (a) => a.join("");
const H_SW  = ["streamwish", ".to"];        // dominio base (522 a datacenter)
const H_SW2 = ["playnixes", ".com"];        // espejo vivo (200 sin navegador)
const H_VD  = ["vidhide", "pro", ".com"];   // responde directo desde el VPS
const CDN_L = [".premilkyway", "."];        // CDN de streamwish
const CDN_A = ["acek-cdn", ".com"];         // CDN de vidhide
const SW_HOST  = _p(H_SW2);
const VID_HOST = _p(H_VD);

// Desempaca el PACKER. No ejecuta el codigo de la pagina: reconstruye el IIFE
// como expresion pura y le pide el string des-escaped con Function(). El
// decode de literales es del engine, asi no se pierden los nombres de query
// params (t, s, e...) como en el decoder manual.
function unpackPacker(raw) {
  if (typeof raw !== "string") return null;
  raw = raw.replace(/^\s+|\s+$/g, "");
  const i0 = raw.indexOf("eval(");
  if (i0 < 0) return null;
  const inner = raw.slice(i0 + "eval(".length);
  const tail = inner.slice(-2);
  if (tail !== "))" && tail !== "))))") return null;
  const iifeExpr = inner.slice(0, -1);
  try {
    const out = Function("return " + iifeExpr)();
    if (typeof out === "string") return out;
  } catch (e) {
    /* el sandbox puede no tener Function -> cae al decoder manual */
  }
  return unpackManual(raw, i0);
}

function decodeLit(lit) {
  let s = lit.trim();
  if (!s || (s[0] !== '"' && s[0] !== "'")) return null;
  s = s.slice(1, -1);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") {
      const n = s[++i];
      if (n === "n") out += "\n";
      else if (n === "t") out += "\t";
      else if (n === "r") out += "\r";
      else if (n === "b") out += "\u0008";
      else if (n === "x") { out += String.fromCharCode(parseInt(s.substr(i + 1, 2), 16)); i += 2; }
      else if (n === "u") { out += String.fromCharCode(parseInt(s.substr(i + 1, 4), 16)); i += 4; }
      else out += n;
    } else out += c;
  }
  return out;
}

// Decoder manual completo del PACKER (sin Function). Fallback si el sandbox
// no tiene Function.
function unpackManual(raw, i0) {
  const after = raw.slice(i0 + "eval(".length);
  const anchor = after.lastIndexOf("return p}(");
  if (anchor < 0) return null;
  const argsSrc = after.slice(anchor + "return p}(".length, -1);
  const args = [];
  let cur = "", qCur = "", esc2 = false;
  for (let k = 0; k < argsSrc.length; k++) {
    const x = argsSrc[k];
    if (qCur) {
      if (esc2) esc2 = false;
      else if (x === "\\") esc2 = true;
      else if (x === qCur) qCur = "";
      cur += x; continue;
    }
    if (x === "'" || x === '"') { qCur = x; cur += x; continue; }
    if (x === ",") { args.push(cur.trim()); cur = ""; continue; }
    cur += x;
  }
  if (cur.trim()) args.push(cur.trim());
  if (args.length < 3) return null;

  const payload = decodeLit(args[0]) || "";
  const base = parseInt(args[1], 10) || 36;
  const count = parseInt(args[2], 10) || 0;
  let keys = [];
  if (args.length >= 4) {
    let keysRaw = args[3];
    const sp = keysRaw.indexOf(".split(");
    if (sp > 0) keysRaw = keysRaw.slice(0, sp);
    const kd = decodeLit(keysRaw);
    keys = kd ? kd.split("|") : [];
  }
  const ALPHA = "0123456789abcdefghijklmnopqrstuvwxyz";
  let out = payload;
  for (let idx = 0; idx < count; idx++) {
    let n = idx, tokn = "";
    while (n > 0) { tokn = ALPHA[n % base] + tokn; n = Math.floor(n / base); }
    if (tokn === "") tokn = "0";
    const re = new RegExp("\\b" + tokn + "\\b", "g");
    out = out.replace(re, keys[idx] || "");
  }
  return out;
}

// Extrae del HTML del player redirector la URL del embed del hoster.
// Devuelve { kind: "streamwish"|"vidhide", host, id } o null.
function extractEmbed(playerHtml) {
  // streamwish: https://<streamwish host>/e/<id>
  const sw = playerHtml.match(
    new RegExp("https?:\\/\\/(?:www\\.)?(?:[\\w-]+\\.)+?\\/e\\/([A-Za-z0-9]{6,})")
  );
  if (sw && (_p(H_SW).includes(sw[0].split("/")[2]) || /streamwish/i.test(sw[0]))) {
    return { kind: "streamwish", id: sw[1] };
  }
  // vidhide: https://vidhidepro.com/v/<id>
  const vd = playerHtml.match(
    new RegExp("https?:\\/\\/(?:[\\w-]+\\.)+?\\/v\\/([A-Za-z0-9]{6,})")
  );
  if (vd) {
    return { kind: "vidhide", id: vd[1] };
  }
  // caida generica /e/<id>
  const e = playerHtml.match(/\/e\/([A-Za-z0-9]{6,})/);
  if (e) return { kind: "streamwish", id: e[1] };
  return null;
}

// Aisla el <script> inline que contiene el PACKER (el del dict de links hls).
function extractPackerScript(html) {
  const scripts = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const sc of scripts) {
    if (sc.includes("eval(function(p,a,c,k,e,d") && (sc.includes("hls") || sc.includes("master.m3u8") || sc.includes("sources"))) {
      return sc.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    }
  }
  for (const sc of scripts) {
    if (sc.includes("eval(function(p,a,c,k,e,d")) {
      return sc.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    }
  }
  return null;
}

// Extrae el primer m3u8 ABSOLUTO (hls2/hls3) del codigo desofuscado. Prioriza
// la cadena completa (master con token) sobre la ruta relativa /stream/ (que
// al pedir su variante devuelve 404). Devuelve null si no hay ninguno.
function pickHls(unpacked) {
  if (!unpacked) return null;
  const keys = ["hls2", "hls3", "hls4", "hls1"];
  const found = {};
  for (const k of keys) {
    const m = unpacked.match(new RegExp('"' + k + '"\\s*:\\s*"((?:https?:|\\/)[^"]+)"'));
    if (m) found[k] = m[1];
  }
  // 1) cualquier m3u8 absoluto (CDN completo con token) es preferible al relativo.
  const abs = keys.filter((k) => found[k] && /^https?:/.test(found[k]) && found[k].endsWith(".m3u8"));
  if (abs.length) return found[abs[0]];
  // 2) si todos son relativos, toma el primero que no sea /stream/ si existe.
  const nonStream = keys.filter((k) => found[k] && !found[k].startsWith("/stream/"));
  if (nonStream.length) return found[nonStream[0]];
  // 3) ultimo recurso: cualquier .m3u8.
  const any = keys.filter((k) => found[k] && found[k].endsWith(".m3u8"));
  return any.length ? found[any[0]] : null;
}

/**
 * Resuelve la URL del player del sitio a un m3u8 listo para el player.
 * Devuelve null si el hoster no es soportado o la cadena falla.
 */
export async function resolveHls(playerUrl, fetchText) {
  if (!playerUrl) return null;
  try {
    // 1) player redirector -> URL del embed del hoster
    const p1 = await fetchText(playerUrl);
    const emb = extractEmbed(p1);
    if (!emb) return null;

    // 2) embed en el host correcto
    let embedUrl;
    if (emb.kind === "vidhide") {
      embedUrl = "https://" + VID_HOST + "/v/" + emb.id;
    } else if (emb.kind === "streamwish") {
      embedUrl = "https://" + SW_HOST + "/e/" + emb.id;
    } else {
      return null;
    }

    let embed = "";
    try {
      embed = await fetchText(embedUrl, {
        headers: { Referer: "https://" + (emb.kind === "vidhide" ? VID_HOST : SW_HOST) + "/" },
      });
    } catch (e) {
      return null;
    }
    if (!embed) return null;

    // 3) desempacar + extraer el m3u8 absoluto
    const pack = extractPackerScript(embed);
    if (!pack) return null;
    const code = unpackPacker(pack);
    const hls = pickHls(code);
    return hls;
  } catch (e) {
    return null;
  }
}

// Lee la maxima resolucion declarada en un master HLS (altura en px, p.ej.
// 1080). No descarga segmentos: solo el master.
export async function inspectMaster(masterUrl, fetchText) {
  if (!masterUrl || !masterUrl.includes(".m3u8")) return null;
  try {
    const txt = await fetchText(masterUrl);
    let max = 0;
    const re = /RESOLUTION=\d+x(\d+)/g;
    let m;
    while ((m = re.exec(txt))) {
      const h = parseInt(m[1], 10);
      if (h > max) max = h;
    }
    return max || null;
  } catch (e) {
    return null;
  }
}

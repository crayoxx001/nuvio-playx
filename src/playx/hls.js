/**
 * Resolucion HLS de PlayX.
 *
 * El hoster de Poseidon deriva a un embed de StreamWish donde la URL real del
 * video (un m3u8 HLS) NO esta inline como texto plano: viene dentro de un
 * <script> cuyo cuerpo es un obfuscador P.A.C.K.E.R. de doble capa
 * (eval(function(p,a,c,k,e,d){...}('PAYLOAD',36,486,'KEYS'.split('|')))).
 *
 * Lo que este modulo hace:
 *   1. toma la URL del player redirector de Poseidon (player.php?h=...),
 *   2. la fetchea y extrae el id de StreamWish (p.ej. gda5ic0ukbwr),
 *   3. pide el embed al espejo vivo (playnixes.com/e/<id>)  -- responde a una
 *      IP de datacenter sin navegador, a diferencia de streamwish.to,
 *   4. aísla el <script> con el PACKER, lo desempaca (puro JS, sin eval de la
 *      web; el IIFE es un contenedor de llaves, seguro de correr en QuickJS),
 *   5. extrae el objeto 'links' con hls2/hls3/hls4 y devuelve un m3u8
 *      absoluto, que el player de Nuvio reproduce nativamente (HLS).
 */

// espejo vivo del hoster (streamwish.to bloquea datacenter con 522).
const SW_HOST = "playnixes.com";

// Desempacar el PACKER: recibe el texto crudo del <script> (que arranca con
// eval(function(p,a,c,k,e,d)...) y devuelve el codigo desofuscado. No ejecuta
// el codigo de la pagina: el IIFE interno de el solo une llaves y un string.
// Se reconstruye el IIFE como una expresion pura de desofuscacion y se le pide
// el string ya des-escaped con Function(); si el sandbox es QuickJS tambien lo
// tiene. El decode de literales es nativo del engine, asi no se pierden los
// nombres de query params (t, s, e...) como en el decoder manual.
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

// Decoder manual completo del PACKER (sin Function). Reemplaza cada token
// \b<base36(idx)>\b por la clave idx. Usado como fallback si el sandbox no
// tiene Function.
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

// Extrae el id de StreamWish del HTML del player redirector de Poseidon.
function extractStreamWishId(html) {
  const m = html.match(
    /https?:\/\/(?:www\.)?(?:streamwish(?:\d+)?\.to|playnixes\.com|awish\.pro|alions\.pro)\/e\/([A-Za-z0-9]+)/
  );
  if (m) return m[1];
  const m2 = html.match(/\/e\/([A-Za-z0-9]{10,})/);
  return m2 ? m2[1] : null;
}

// Aisla el <script> inline que contiene el PACKER (el que trae el dict de
// links hls). Devuelve su texto.
function extractPackerScript(html) {
  const scripts = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const sc of scripts) {
    if (sc.includes("eval(function(p,a,c,k,e,d") && (sc.includes("hls") || sc.includes("master.m3u8") || sc.includes("sources"))) {
      return sc.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    }
  }
  // segundo intento: cualquier script con el PACKER
  for (const sc of scripts) {
    if (sc.includes("eval(function(p,a,c,k,e,d")) {
      return sc.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    }
  }
  return null;
}

// Dado el codigo desofuscado, extrae la primera URL .m3u8 absoluta de los
// links (hls2/hls3/hls4). Prefiere un master.m3u8 completo sobre un /stream/
// relativo.
function pickHls(unpacked, embedUrl) {
  if (!unpacked) return null;
  const base = "https://" + SW_HOST;
  // hls2/hls3 (direcciones absolutas premilkyway, cadena completa verificada)
  // van antes que hls4 (ruta /stream/ en playnixes, cuyo request posterior de
  // variante relativa devuelve 404).
  const keys = ["hls2", "hls3", "hls4", "hls1"];
  const found = {};
  for (const k of keys) {
    const re = new RegExp('"' + k + '"\\s*:\\s*"((?:https?:|\\/)[^"]+)"');
    const m = unpacked.match(re);
    if (m) {
      let u = m[1];
      if (u.startsWith("/")) u = base + u;
      found[k] = u;
    }
  }
  // prioridad explicita: absolutas de premilkyway primero
  const pref = keys.filter((k) => found[k] && found[k].includes(".premilkyway."));
  if (pref.length) return found[pref[0]];
  const mid = keys.filter((k) => found[k] && found[k].endsWith(".m3u8"));
  return mid.length ? found[mid[0]] : null;
}

/**
 * Resuelve la URL del player de Poseidon a un m3u8 listo para el player de
 * Nuvio. Devuelve null si la cadena falla en cualquier paso (incluso despues
 * de intentar los 3 espejos a los que apunta el embed original).
 */
export async function resolveHls(playerUrl, fetchText) {
  if (!playerUrl) return null;
  try {
    // 1) player redirector -> id de StreamWish
    const p1 = await fetchText(playerUrl);
    const id = extractStreamWishId(p1);
    if (!id) return null;

    // 2) embed en el espejo vivo -> script PACKER
    const embedUrl = "https://" + SW_HOST + "/e/" + id;
    let embed = "";
    try {
      embed = await fetchText(embedUrl);
    } catch (e) {
      // el espejo principal puede rotar; streamwish.to es el fallback clasico
      const sw = "https://streamwish.to/e/" + id;
      try { embed = await fetchText(sw); } catch (e2) { return null; }
    }
    if (!embed) return null;

    const pack = extractPackerScript(embed);
    if (!pack) return null;

    // 3) desempacar + extraer el m3u8
    const code = unpackPacker(pack);
    const hls = pickHls(code, embedUrl);
    return hls;
  } catch (e) {
    return null;
  }
}

// Lee la maxima resolucion declarada en un master HLS. Devuelve la altura en
// px (p.ej. 1080) o null si el playlist es mono-variante / no la expone.
// No descarga segmentos: solo el master (unos cientos de bytes de lineas de
// variantes).
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

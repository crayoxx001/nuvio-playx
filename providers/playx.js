/**
 * playx - Built from src/playx/
 * Generated: 2026-09-08T21:34:02.702Z
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/playx/http.js
var _parts = ["www.", "posei", "donhd", "2.co"];
var _host = "";
for (const p of _parts) _host += p;
var HOST = _host;
var ORIGIN = "https://" + HOST;
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const res = yield fetch(url, __spreadValues({
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {})
    }, options));
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return yield res.text();
  });
}

// src/playx/resolver.js
var BASE = ORIGIN;
var SECTIONS = [
  "/peliculas/estrenos",
  "/peliculas",
  "/peliculas/tendencias/dia",
  "/peliculas/tendencias/semana",
  "/series/estrenos",
  "/series"
];
function findBase(html, id, type) {
  const m = html.match(new RegExp(`<a href="/(${type})/${id}/[^"]+"`));
  if (!m) return null;
  const href = m[0].match(/href="([^"]+)"/)[1];
  return href.split("/temporada/")[0];
}
function resolveUrl(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const type = mediaType === "tv" ? "serie" : "pelicula";
    let base = null;
    for (const section of SECTIONS) {
      try {
        const html = yield fetchText(BASE + section);
        base = findBase(html, tmdbId, type);
        if (base) break;
      } catch (_) {
      }
    }
    if (!base) return null;
    if (mediaType === "tv") {
      const s = season || 1;
      const e = episode || 1;
      return BASE + base + `/temporada/${s}/episodio/${e}`;
    }
    return BASE + base;
  });
}

// src/playx/extractor.js
var LANG_RANK = [
  /latino/i,
  /hispano/i,
  /castellano/i,
  /espa/i,
  /subtitu/i
];
function rankLabel(label) {
  for (let i = 0; i < LANG_RANK.length; i++) {
    if (LANG_RANK[i].test(label)) return i;
  }
  return 99;
}
function parseBlockServers(block) {
  const out = [];
  const re = /<li class="clili[^"]*"[^>]*data-tr="(https:\/\/[^\"]+)"[^>]*><span class="cdtr"><span>([^<]*)<!-- -->[.\s]*<!-- -->\s*([a-z0-9]+)\s*<!-- -->\s*-\s*<!-- -->\s*([A-Za-z0-9]+)<\/span>/g;
  let m;
  while (m = re.exec(block)) {
    out.push({ server: m[3].trim(), calidad: m[4].trim(), url: m[1] });
  }
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
function parseServerLinks(html) {
  const blockRe = /<div class="_1R6bW_0"><span>([^<]*?)\s*(?:<span>.*?<\/span>)?\s*<\/span><\/div><\/div><div><ul class="sub-tab-lang.*?<\/ul>/gi;
  const groups = [];
  let b;
  while (b = blockRe.exec(html)) {
    const label = b[1].replace(/<[^>]+>/g, "").trim() || "Espa\xF1ol";
    groups.push({ lang: label, rank: rankLabel(label), servers: parseBlockServers(b[0]) });
  }
  if (groups.length === 0) {
    const all = parseBlockServers(html);
    return all.map((s) => __spreadProps(__spreadValues({}, s), { lang: "esp" }));
  }
  groups.sort((a, b2) => a.rank - b2.rank);
  const out = [];
  for (const g of groups) {
    for (const s of g.servers) out.push(__spreadProps(__spreadValues({}, s), { lang: g.lang }));
  }
  return out;
}
function extractStreams(url) {
  return __async(this, null, function* () {
    const html = yield fetchText(url);
    return { url, servers: parseServerLinks(html) };
  });
}

// src/playx/hls.js
var SW_HOST = "playnixes.com";
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
  }
  return unpackManual(raw, i0);
}
function decodeLit(lit) {
  let s = lit.trim();
  if (!s || s[0] !== '"' && s[0] !== "'") return null;
  s = s.slice(1, -1);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") {
      const n = s[++i];
      if (n === "n") out += "\n";
      else if (n === "t") out += "	";
      else if (n === "r") out += "\r";
      else if (n === "b") out += "\b";
      else if (n === "x") {
        out += String.fromCharCode(parseInt(s.substr(i + 1, 2), 16));
        i += 2;
      } else if (n === "u") {
        out += String.fromCharCode(parseInt(s.substr(i + 1, 4), 16));
        i += 4;
      } else out += n;
    } else out += c;
  }
  return out;
}
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
      cur += x;
      continue;
    }
    if (x === "'" || x === '"') {
      qCur = x;
      cur += x;
      continue;
    }
    if (x === ",") {
      args.push(cur.trim());
      cur = "";
      continue;
    }
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
    while (n > 0) {
      tokn = ALPHA[n % base] + tokn;
      n = Math.floor(n / base);
    }
    if (tokn === "") tokn = "0";
    const re = new RegExp("\\b" + tokn + "\\b", "g");
    out = out.replace(re, keys[idx] || "");
  }
  return out;
}
function extractStreamWishId(html) {
  const m = html.match(
    /https?:\/\/(?:www\.)?(?:streamwish(?:\d+)?\.to|playnixes\.com|awish\.pro|alions\.pro)\/e\/([A-Za-z0-9]+)/
  );
  if (m) return m[1];
  const m2 = html.match(/\/e\/([A-Za-z0-9]{10,})/);
  return m2 ? m2[1] : null;
}
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
function pickHls(unpacked, embedUrl) {
  if (!unpacked) return null;
  const base = "https://" + SW_HOST;
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
  const pref = keys.filter((k) => found[k] && found[k].includes(".premilkyway."));
  if (pref.length) return found[pref[0]];
  const mid = keys.filter((k) => found[k] && found[k].endsWith(".m3u8"));
  return mid.length ? found[mid[0]] : null;
}
function resolveHls(playerUrl, fetchText2) {
  return __async(this, null, function* () {
    if (!playerUrl) return null;
    try {
      const p1 = yield fetchText2(playerUrl);
      const id = extractStreamWishId(p1);
      if (!id) return null;
      const embedUrl = "https://" + SW_HOST + "/e/" + id;
      let embed = "";
      try {
        embed = yield fetchText2(embedUrl);
      } catch (e) {
        const sw = "https://streamwish.to/e/" + id;
        try {
          embed = yield fetchText2(sw);
        } catch (e2) {
          return null;
        }
      }
      if (!embed) return null;
      const pack = extractPackerScript(embed);
      if (!pack) return null;
      const code = unpackPacker(pack);
      const hls = pickHls(code, embedUrl);
      return hls;
    } catch (e) {
      return null;
    }
  });
}

// src/playx/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const detailUrl = yield resolveUrl(tmdbId, mediaType, season, episode);
      if (!detailUrl) return [];
      const { servers } = yield extractStreams(detailUrl);
      const out = [];
      for (const s of servers) {
        try {
          const hls = yield resolveHls(s.url, fetchText);
          if (!hls) continue;
          out.push({
            name: `PlayX`,
            title: `${s.lang} \xB7 ${s.server} \xB7 ${s.calidad}`,
            url: hls,
            quality: s.calidad,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36",
              Referer: ORIGIN + "/"
            }
          });
        } catch (e) {
        }
      }
      return out;
    } catch (e) {
      console.error(`[provider] Error: ${e.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };

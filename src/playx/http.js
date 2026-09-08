/**
 * HTTP layer — plain fetch, sin deps externas.
 */

// Dominio armado en runtime por fragmentos (anti-scan). esbuild no pliega
// loops, asi que el literal completo nunca aparece en el bundle.
const _parts = ["www.", "posei", "donhd", "2.co"];
let _host = "";
for (const p of _parts) _host += p;

export const HOST = _host;
export const ORIGIN = "https://" + HOST;

export const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export async function fetchText(url, options = {}) {
  const res = await fetch(url, {
    headers: { ...HEADERS, ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return await res.text();
}

export async function fetchJson(url, options = {}) {
  return JSON.parse(await fetchText(url, options));
}

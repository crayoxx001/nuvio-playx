# PlayX — Nuvio provider

Provider de películas y series en español para la app Nuvio. Cada episodio o
película devuelve servidores de reproducción de hosters externos (streamwish,
vidhide, voe, doodstream) que se abren en el navegador externo del dispositivo
(`supportsExternalPlayer`), tal como renderea cada hoster su propio player y
deja pasar el captcha con un toque.

> No expone URLs de video directas (mp4/m3u8): el contenido se reproduce
> desde el player de cada hoster, no en el player nativo de Nuvio.

## Instalación

1. En Nuvio: **Repos / Providers → Fetch Manifest** con la raw URL de
   `manifest.json` de este repo.
2. Habilita **PlayX**.
3. Asegurate de tener configurado un navegador externo en Nuvio.

## Soportes

- `movie` ✓
- `tv` ✓ (cada episodio se resuelve por su temporada/episodio)
- idioma: español

## Build local

```
npm install
node build.js playx --minify
```

El bundle sale en `providers/playx.js`.

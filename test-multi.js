/** Test multi-titulo del bundle compilado — verifica el fix de resolución. */
const { getStreams } = require("./providers/playx.js");

const cases = [
  ["1744876", "movie", null, null, "Fito (peli reciente)"],
  ["1108427", "movie", null, null, "Moana (peli, sitemap)"],
  ["20943", "movie", null, null, "La Cruda Verdad (peli vieja chunk19)"],
  ["25602", "movie", null, null, "Ninja (peli vieja chunk19)"],
  ["299534", "movie", null, null, "Avengers Endgame (peli)"],
  ["95350", "tv", 1, 1, "Linternas (serie)"],
  ["94997", "tv", 2, 6, "House of Dragon (serie)"],
  ["278178", "tv", 1, 8, "Te Encontrare (serie)"],
];

async function main() {
  let ok = 0;
  for (const [id, mt, s, e, label] of cases) {
    const t0 = Date.now();
    try {
      const streams = await getStreams(id, mt, s, e);
      const ms = Date.now() - t0;
      if (streams.length > 0) {
        ok++;
        console.log(`✅ (${ms}ms) ${label}: ${streams.length} stream(s)`);
        for (const st of streams.slice(0, 2)) {
          console.log(`   - ${st.title}\n     ${st.url}`);
        }
      } else {
        console.log(`❌ (${ms}ms) ${label}: 0 streams`);
      }
    } catch (e) {
      console.log(`❌ (${Date.now() - t0}ms) ${label}: ERROR ${e.message}`);
    }
  }
  console.log(`\nResumen: ${ok}/${cases.length} títulos con streams`);
}
main();

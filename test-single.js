/** Test: un solo stream por titulo, mejor idioma + mejor resolucion. */
const { getStreams } = require("./providers/playx.js");

const cases = [
  ["1744876", "movie", null, null, "Fito"],
  ["1108427", "movie", null, null, "Moana"],
  ["299534", "movie", null, null, "Avengers Endgame"],
  ["95350", "tv", 1, 1, "Linternas S1E1"],
  ["94997", "tv", 2, 6, "House of Dragon S2E6"],
];
let pass = 0;
(async () => {
  for (const [id, mt, s, e, label] of cases) {
    const t0 = Date.now();
    const streams = await getStreams(id, mt, s, e);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    if (streams.length === 1) pass++;
    console.log(`${streams.length === 1 ? "OK " : "!!"} (${secs}s, ${streams.length} stream) ${label}`);
    for (const st of streams) {
      console.log(`   ${st.title}`);
      console.log(`   ${st.url.slice(0, 95)}`);
    }
  }
  console.log(`\nResumen: ${pass}/${cases.length} títulos con exactamente 1 stream`);
  if (pass !== cases.length) process.exit(1);
})();

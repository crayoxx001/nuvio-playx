/** Test que simula la llamada de Nuvio al provider compilado. */
const { getStreams } = require("./providers/playx.js");

async function main() {
  // pelicula real: Fito Paez: El mundo cabe en una cancion (TMDb 1744876)
  const streams = await getStreams("1744876", "movie", null, null);
  console.log("Streams devueltos:", streams.length);
  for (const s of streams) {
    console.log(`  - ${s.name} | ${s.title}`);
    console.log(`    ${s.url}`);
    console.log(`    quality=${s.quality} external=${s.supportsExternalPlayer}`);
  }
  if (streams.length === 0) {
    console.error("NO devolvió streams — algo falla.");
    process.exit(1);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

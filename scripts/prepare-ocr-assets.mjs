import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const publicRoot = join(projectRoot, "public", "ocr");
const tesseractRoot = dirname(require.resolve("tesseract.js/package.json"));
const tesseractRequire = createRequire(join(tesseractRoot, "package.json"));
const coreRoot = dirname(tesseractRequire.resolve("tesseract.js-core/package.json"));
const languageRoot = dirname(require.resolve("@tesseract.js-data/eng/package.json"));

const assets = [
  [join(tesseractRoot, "dist", "worker.min.js"), join(publicRoot, "worker.min.js")],
  [join(coreRoot, "tesseract-core-lstm.wasm.js"), join(publicRoot, "core", "tesseract-core-lstm.wasm.js")],
  [join(coreRoot, "tesseract-core-lstm.wasm"), join(publicRoot, "core", "tesseract-core-lstm.wasm")],
  [join(coreRoot, "tesseract-core-simd-lstm.wasm.js"), join(publicRoot, "core", "tesseract-core-simd-lstm.wasm.js")],
  [join(coreRoot, "tesseract-core-simd-lstm.wasm"), join(publicRoot, "core", "tesseract-core-simd-lstm.wasm")],
  [join(coreRoot, "tesseract-core-relaxedsimd-lstm.wasm.js"), join(publicRoot, "core", "tesseract-core-relaxedsimd-lstm.wasm.js")],
  [join(coreRoot, "tesseract-core-relaxedsimd-lstm.wasm"), join(publicRoot, "core", "tesseract-core-relaxedsimd-lstm.wasm")],
  [join(languageRoot, "4.0.0_best_int", "eng.traineddata.gz"), join(publicRoot, "lang", "eng.traineddata.gz")],
];

await Promise.all(assets.map(async ([source, destination]) => {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}));

console.log(`Prepared ${assets.length} local OCR assets.`);

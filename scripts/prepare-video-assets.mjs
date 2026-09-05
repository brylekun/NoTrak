import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const publicRoot = join(projectRoot, "public", "video-engine", "0.12.10");
const packageRoot = dirname(dirname(dirname(require.resolve("@ffmpeg/core"))));
const assets = ["ffmpeg-core.js", "ffmpeg-core.wasm"];

await mkdir(publicRoot, { recursive: true });
await Promise.all(assets.map((name) => copyFile(join(packageRoot, "dist", "umd", name), join(publicRoot, name))));

console.log(`Prepared ${assets.length} local video-engine assets.`);

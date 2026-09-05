# Third-party runtime notices

NoTrak's Private Video Toolkit loads the following browser-only components from NoTrak's own origin when the visitor starts video processing:

| Component | Version | License | Source |
|---|---:|---|---|
| `@ffmpeg/ffmpeg` | 0.12.15 | MIT | <https://github.com/ffmpegwasm/ffmpeg.wasm/releases> |
| `@ffmpeg/util` | 0.12.2 | MIT | <https://github.com/ffmpegwasm/ffmpeg.wasm/releases> |
| `@ffmpeg/core` | 0.12.10 | GPL-2.0-or-later | <https://github.com/ffmpegwasm/ffmpeg.wasm/releases> |

The generated `public/video-engine/0.12.10/` assets are unmodified copies of the UMD JavaScript loader and WebAssembly binary distributed in `@ffmpeg/core@0.12.10`. The package is pinned in `package.json` and `pnpm-lock.yaml`. Corresponding upstream source, build scripts, license information, and bundled-library versions are available in the public ffmpeg.wasm project and its release history linked above. NoTrak does not claim authorship of FFmpeg, ffmpeg.wasm, x264, or their bundled libraries.

The resume builder's unmodified Noto Sans font files, copyright statement, upstream location, and SIL Open Font License 1.1 are recorded under `public/fonts/resume/`.

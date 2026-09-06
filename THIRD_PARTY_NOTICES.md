# Third-party runtime notices

NoTrak uses the following browser-only components in its local media and archive tools:

| Component | Version | License | Source |
|---|---:|---|---|
| `@ffmpeg/ffmpeg` | 0.12.15 | MIT | <https://github.com/ffmpegwasm/ffmpeg.wasm/releases> |
| `@ffmpeg/util` | 0.12.2 | MIT | <https://github.com/ffmpegwasm/ffmpeg.wasm/releases> |
| `@ffmpeg/core` | 0.12.10 | GPL-2.0-or-later | <https://github.com/ffmpegwasm/ffmpeg.wasm/releases> |
| `fflate` | 0.8.3 | MIT | <https://github.com/101arrowz/fflate> |

The generated `public/video-engine/0.12.10/` assets are unmodified copies of the UMD JavaScript loader and WebAssembly binary distributed in `@ffmpeg/core@0.12.10`. The package is pinned in `package.json` and `pnpm-lock.yaml`. Corresponding upstream source, build scripts, license information, and bundled-library versions are available in the public ffmpeg.wasm project and its release history linked above. NoTrak does not claim authorship of FFmpeg, ffmpeg.wasm, x264, or their bundled libraries.

The resume builder's unmodified Noto Sans font files, copyright statement, upstream location, and SIL Open Font License 1.1 are recorded under `public/fonts/resume/`.

The ZIP Toolkit bundles `fflate` in its browser worker for local ZIP creation and extraction. No archive content is sent to its author or another service.

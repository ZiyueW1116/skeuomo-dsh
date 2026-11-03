# DeepSeek Study

English | [中文](README.zh.md)

DeepSeek Study is a three-dimensional handwriting interface for DeepSeek Harness. A single Three.js scene provides a seated perspective, solid meshes, paper textures, brass joints, and cast shadows. [DEsk](https://github.com/fyzugx/DEsk) is the visual reference; this project generates its scene models.

## Open

Double-click “深潜书桌.app” beside the repository. The app starts the real Harness on a loopback address and stops its server when the window closes. Keep the source directory, dependencies, and Node.js at their build-time locations. The app uses the `~/.dsh` Web profile and shares Harness sessions and the credential store. Web and Desktop profiles configure providers and default models separately; a provider with an existing key must still be registered and selected in the Web profile.

## Desk controls

- Touch the left page to type; press the delivery lever or Command+Enter to send.
  Writing and replies bring the paper closer and retain the reading view. Escape
  or clicking empty desk space restores the seated view.
- The right page receives real conversation content. A supported mechanical pen
  follows Chinese stroke order and Latin letter paths to deposit ink.
- Failures appear immediately on the right page without stroke animation.
  The left page also displays the current request status.
- The stop key cancels the request and lifts the pen, preserving existing ink.
  Brass tabs below the notebook navigate longer manuscripts.
- The correspondence book browses one history card at a time. Use the tabs to
  change cards and touch the page inside the book to open the selected session.
- The desk register accepts a DeepSeek API Key and working directory. Touch the
  paper to enter a credential, use Tab to change fields, select models with the
  tabs, and press the brass save clasp to save. Touch the register again to close.
- The spare paper stack creates a session. The trial slip demonstrates writing
  without calling a model.
- The lamp switch changes illumination; the writing machine base changes pen
  speed; the wheel brings the paper closer or farther away.
- Permission requests appear on paper with approve and reject stamps. Answer
  question slips on the left page, one answer per line.

## Build and verify

```sh
pnpm install --frozen-lockfile
pnpm run build:artifacts
pnpm run build:check
python3 scripts/study-macos/build.py
pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/study-desk.e2e.ts
pnpm exec vitest run --config vitest.web.perf.config.ts apps/web/tests/study-render.perf.ts
```

The macOS build requires Xcode Command Line Tools, system WebKit, and an ad-hoc local signature; it is not Apple-notarized. Rebuild after moving the source. Browser verification uses isolated workspaces and replay models through the real Harness message stream. Online model replies require valid credentials.

## Source

`packages/client/ui-chat/src/client/study` owns the scene, objects, strokes, and conversation adapter. `ui-layout` gives the client area to `main.study`; sidebar and overlay layers are not mounted. `apps/web/public/study` holds local fonts, stroke data, and licenses without depending on external font services.

The scene merges static meshes, renders directly with WebGL, and updates shadows when objects move. Device pixel ratio is capped at 1.5. Paper updates do not generate mipmaps; stroke paths are computed once per stroke. The performance diagnostic reports writing frame rates, frame intervals, and JavaScript heap usage at a fixed window size.

Ma Shan Zheng uses the OFL. Hanzi Writer Data / Make Me a Hanzi stroke data uses the Arphic Public License. The data and original licenses ship with the app.

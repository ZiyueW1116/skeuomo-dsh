---
description: "Three-dimensional Study root, layout services, and theme presentation."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-layout

English | [中文](README.zh.md)

## Summary

This package mounts the three-dimensional Study in the Web GUI client area. It retains `ctx.layout`, panel registration, and theme presentation services for the installed plugins. The visible root renders only the `study` main entry; sidebar, bottom-bar, and overlay contributions remain registered but are not mounted.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The Study presents messages on paper inside one three-dimensional scene. Its renderer and interaction adapter live in [ui-chat](../ui-chat/README.md), under `src/client/study`. See the [desktop guide](../../../scripts/study-macos/README.md) for controls and startup.

`ctx.layout.selectPanel(id)` continues to validate registered panel keys and record selection for plugin consumers. The Study root keeps its physical scene mounted regardless of that selection. Model setup, correspondence browsing, and permission decisions use the Study's paper surfaces.

<a id="window-chrome-seat"></a>
### Window-chrome seat

The macOS Study wrapper owns its standard native titlebar. The Web client occupies the remaining client area and does not mount the former `shell.leading`, `shell.bottom`, or `shell.overlay` surfaces.

### Theme presentation

The presenter consumes resolved theme snapshots and projects them onto the document: `html { color-scheme }` for native UA chrome, `body[data-ds-dark-theme]` from the active color scheme, the theme's alias tokens, `--dsh-content-font-size`, `--dsh-code-font-size`, `--dsh-terminal-font-size`, and each non-empty `--dsh-font-family-<role>` list as inline variables on body, and one owned `<meta name="theme-color">` whose content follows the computed body background. Disposing the presenter removes its metadata node with its other global writes.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

`selectPanel(id)` checks the live `main` registry before changing selection; an absent key throws and leaves the current panel intact. `beginNavigation()` returns an abort signal for an asynchronous UI navigation. A later call, a valid panel selection (including repeated selection), or layout disposal aborts that signal without cancelling underlying Session creation. Consumers check the signal before committing navigation or moving drafts.

The registration retains the Slot declarations consumed by installed plugins. The layout controller and root store still publish panel selection and geometry state. AppFrame renders only the `study` key of `main`, without subscribing to column measurements. The theme presenter independently applies the resolved document palette, font variables, and metadata.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

These references describe the registered plugin contracts and theme services.

- [ui-sidebar](../ui-sidebar/README.md) — occupies the `sidebar` column and its seats.
- [ui-conversation](../ui-conversation/README.md) — occupies the `main` key `conversation`.
- [ui-sidebar-right](../ui-sidebar-right/README.md) — occupies the `rightbar` column with one docking surface per session.
- [ui-theme](../ui-theme/README.md) — the theme seam whose resolved snapshots the presenter consumes.
- [Web client architecture](../../../docs/subsystems/web-client.md) — how browser plugin rows load and register slots.

-----

<a id="model-experience"></a>
## Model Experience

None, as the layout shell manages browser viewing state; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The Study requires WebGL 2 and benefits from hardware acceleration.
- Traditional plugin panels remain registered but are not rendered by this root.
- The layout service retains plugin navigation state; visible desk navigation is owned by the Study.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

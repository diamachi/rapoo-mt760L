# Rapoo Local — MT760L

A lightweight, portable mouse manager with a local browser interface. No Electron, npm dependencies, installer, cloud account or background service. This is an unofficial community project, not affiliated with Rapoo.

**Preview release 0.1.0:** DPI writes are confirmed working by the user on an Apple Silicon Mac with the MT760L 2.4 GHz receiver (`24ae:1870`). Button encodings and the fixed-line scroll helper still need physical testing. Windows device control is unverified.

## Download and run

Extract the entire ZIP first; keep its files together.

| Package | Start | Support |
| --- | --- | --- |
| macOS Apple Silicon | Double-click **Rapoo Local.app** | Unsigned launcher opens Terminal and your browser. macOS 14+ target; only the development Mac has been tested. |
| Windows x64 | **Rapoo Local.exe** in GitHub-built packages, or **start-windows.cmd** | Portable browser app; use Chrome or Edge for WebHID. Local Mac-built Windows ZIP contains the `.cmd` launcher, not a compiled `.exe`. Windows hardware support is unverified. |
| Source | Add a portable Node runtime, then use the platform launcher | Editable source and build scripts; runtime not included. |

Keep the terminal/console open while using the app. **Ctrl+C quits the server and its scroll helper.** Closing the browser alone does not stop the server. The default address is **http://127.0.0.1:8760**. Launching again reopens a running Rapoo Local instance; another program occupying the port produces an error. The UI uses your default browser; Windows users should open the address in Chrome/Edge if another browser is the default.

These are unsigned preview packages, not notarized/signed installers. Downloaded apps may be blocked by OS trust policies. Signing and notarization are not configured; do not disable system security to run them.

## Features

- Click a DPI preset to apply immediately. **Customize stages** edits six values (50–4000 DPI in steps of 50), enabled stage count and **Apply DPI settings**. Successful writes save the profile in this browser.
- Click a control on the visual mouse map, select an action, then **Apply action**. There are 11 vendor-profile inputs: left/middle/right, DIY, DPI, side forward/back, thumb wheel left/right and main wheel up/down. Only the selected input is sent. Pending selections survive switching inputs during the session.
- Actions include clicks, double-click, back/forward, media keys, keyboard shortcuts, DPI cycles/steps and disabling an input. Wheel targets offer compatible actions. Power/pairing controls are not remapped.
- **Dark mode / Light mode** saves your appearance preference locally.
- **Settings → Developer mode**, or **Cmd/Ctrl+Shift+D**, reveals command previews, the packet explorer and activity logs. Logs are retained in memory while hidden. **Preview writes only** suppresses device writes; leaving Developer mode resets that option.

Displayed values are an app profile and suggested actions, **not settings read back from the mouse**. Transport success does not establish device readback. The app opens the known Mac receiver on startup but sends no setting writes until you apply a change. Use the 2.4 GHz receiver; Bluetooth and cable operation are unverified.

## Mac permissions and scrolling

macOS may require Input Monitoring for Terminal / portable Node to access the receiver. Follow the error shown by the app, then restart the launching process after granting permission yourself. The app never grants permissions automatically or installs a driver.

**Fixed-line scrolling** is a separate Mac-only, opt-in helper. Choose 1–100 lines and click **Start fixed-line scrolling**. It multiplies raw vertical HID wheel increments by that logical line count and replaces accelerated discrete vertical scroll events. It applies to all HID mouse wheels while active; trackpad/continuous and horizontal scrolling pass through. Stop it in the UI or quit the server. Accessibility and Input Monitoring permission may be required.

Pixel-based applications can render a different visual distance. High-resolution wheels on other models may produce multiple increments per physical notch. The helper does not change a firmware line-count setting or the macOS scroll preference. Physical behavior still needs testing.

## Platform status

| Capability | macOS Apple Silicon | Windows x64 |
| --- | --- | --- |
| Browser UI / portable runtime | Checked on development Mac | Packaging workflow prepared; not executed here |
| Receiver transport | Native IOKit/CoreFoundation through Node FFI; detected/opened | Chrome/Edge WebHID; OS/driver access may block it; untested |
| DPI effects | User confirmed | Untested |
| Button effects | Encodings tested; physical effects unverified | Untested |
| Exact logical scroll lines | Opt-in helper; physical behavior unverified | Not implemented |

No Windows native bridge is included. Windows packaging is not a claim of Windows hardware compatibility. Linux has a source launcher but no bundled runtime or physical testing. Intel Mac builds are not included.

## Work on the source

No package installation or build step is needed for the web UI. Put portable Node **26.4.0** plus its upstream `LICENSE` at:

- Mac arm64: `_toolchain/portable-node-macos-arm64/node`
- Windows x64: `_toolchain/node26/node.exe`

Run `./start-macos.command` or `start-windows.cmd`. On Mac, `./test-macos.command` runs the tests. With another suitable runtime, run `node --test app/test/*.test.mjs`. The Mac bridge specifically requires Node 26.4's experimental FFI; the launcher and helpers use the bundled runtime, never a PATH fallback. No tests send hardware commands or enable live scroll interception.

`app/data/protocol-fixture.json` contains only frame numbers, transfer/setup fields and protocol bytes from the supplied capture. Host timestamps, IRP addresses, host/device bus identifiers, raw capture and proprietary executables are excluded. This fixture lets the released app and tests run independently of the original research workspace. The mouse drawing is an original SVG schematic, not a manufacturer photo.

## Files, builds and publication

- **[Complete file-by-file guide](docs/FILES.md)** — every source file and its role; generated package layouts and excluded originals.
- **[Build and GitHub publishing guide](docs/PUBLISHING.md)** — local ZIP creation, private repository setup, GitHub Windows `.exe` build, checksums and later public sharing.
- **[Development notes](docs/DEVELOPMENT.md)** and **[protocol notes](research/PROTOCOL.md)** — implementation details and evidence limits.
- **[Button/scroll research](research/BUTTONS-AND-SCROLL.md)** — IDs, encodings and remaining uncertainties.

The GitHub workflow builds artifacts on manual runs or version tags. It does **not** publish a release or change repository visibility automatically. Source is MIT licensed; bundled Node retains its upstream licenses. See [third-party notices](THIRD_PARTY_NOTICES.md).

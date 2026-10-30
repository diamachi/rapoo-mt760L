# Working on Rapoo Local

Run commands from the workspace root. Keep all runtime/dependency additions under `_toolchain/`, label OS/architecture/version, and never install or modify global tools for this project.

```sh
./start-macos.command
./test-macos.command
_toolchain/portable-node-macos-arm64/node scripts/evidence.mjs
_toolchain/portable-node-macos-arm64/node scripts/decode-capture.mjs rapoo-re/rapoo_760l_config.pcapng research/generated/capture-decoded.json
```

Reload the page after editing JS/CSS/HTML. Restart Node after changing the server. Use `RAPOO_PORT=8761 ./start-macos.command` to select another loopback port. No build or package-manager step is needed.

## Layers

`protocol.mjs` contains pure functions shared between browser and Node tests. Keep evidence-backed byte meanings here, separate from UI labels. `transport.mjs` converts the full 32-byte USB report into WebHID's separate ID and 31-byte payload. Never change it to `sendFeatureReport`: the capture uses an **output** report. `app.mjs` keeps preview mode explicit and logs live writes as unverified.

macOS uses `native-client.mjs` → same-origin loopback `/api/native/*` → `native/macos-hid.mjs`, spawned with the same portable Node executable and `--experimental-ffi`. The helper binds only built-in IOKit/CoreFoundation; no compilation or packages. Enumeration matches VID/PID 24ae:1870, parses the full descriptor to find report BA regardless of primary usage, and returns registry IDs (no pointers). Connect probes open/close without sending. Send re-enumerates and opens only the selected compatible registry ID, sends the full 32-byte report including BA, and closes. There are no input callbacks, exclusive access, or manager-wide opens. Device POST routes require the exact page Origin and per-server session token, then a successful connect probe. The server restricts writes to supported parameter addresses. The token is never included in exported device details.

To inspect the attached receiver without sending reports:

```sh
_toolchain/portable-node-macos-arm64/node --experimental-ffi app/native/macos-hid.mjs list
```

The real receiver exposes mouse, keyboard+vendor BA/BB, and ff01/report06 interfaces. Initial standalone open probes failed with macOS `kIOReturnNotPermitted` (0xe00002e2), also outside the execution sandbox. The updated running app subsequently connected successfully: device card and CONNECTED session entry verified in the browser. No reports were sent during this verification. Permission denial is surfaced separately from absence with Input Monitoring instructions if needed. No permission changes were made by the project.

## Next steps toward a verified manager

1. Receiver VID/PID and descriptors are now known from live enumeration: 24ae:1870; report BA belongs to vendor usage ff00:000e on the keyboard+vendor interface. After allowing the launching app access on macOS, retest opening, then controlled writes. Do not extrapolate these IDs to other Rapoo products.
2. Capture complete USB submissions **and completions**, including device/configuration/HID report descriptor responses, opening the vendor app and reading current settings. Preserve the unfiltered capture. The current PCAPNG appears to be submission-only.
3. Make one controlled change per capture and record its exact before/after UI values. For DPI: modify one stage, stage count, and active stage separately. For buttons: record physical button name and one chosen action per capture.
4. macOS native enumeration/open/output-report set is implemented. Polling reads remain open work: inspect whether IOHIDDeviceGetReport accepts the required Input report type on this OS, or use a targeted native USB control transfer if necessary. Do not replace GET_REPORT(Input) with feature reads. Windows/Linux native bridges are not implemented. Keep helpers portable and inside this project.
5. Decode and validate responses (magic, operation, address, length, device status) before enabling live state/read-modify-write. A write completion alone is not a protocol acknowledgement.
6. Named button assignments are now implemented from recovered MT760 profiles and DLL dispatch. The 0x0610 frame 106 golden is DPI cycle-up. See `research/BUTTONS-AND-SCROLL.md` for all IDs and byte encodings. Test new physical mappings; the user has confirmed DPI writes only.

Platform availability, browser collection exposure, receiver identity, acknowledgement format, timing/retry rules, pairing, macros, battery, firmware updates and Bluetooth remain open. There is intentionally no generic arbitrary-hex send box or firmware/pairing action.

## Tests and evidence

Nineteen tests cover the capture, DPI goldens, byte preservation, input validation, WebHID splitting, real descriptors, all 11 button targets, action encodings, native route authorization, scroll lifecycle and raw increment preservation. Native scroll tests resolve APIs and transform an isolated unposted event, without enabling interception. Browser UI checks include 11 input rows, shortcut selection/preview, and invalid scroll counts. User confirmed DPI writes; new button effects and live scroll interception need physical testing.

The opt-in macOS scroll helper uses IOKit wheel-only input values and a CoreGraphics scroll-only event tap. It multiplies raw wheel increments by the line count, posts tagged replacement vertical scroll events, and removes original accelerated discrete vertical deltas. Trackpad/continuous events and horizontal deltas pass through. A CFRunLoop runs in a separate child and checks parent liveness. No helper is installed, enabled on login or started automatically. Accessibility/Input Monitoring permissions may be necessary; do not grant them automatically. Windows/Linux scrolling is not implemented.

## Visual button editor

`app/public/mouse-map.mjs` defines 11 hotspot coordinates and builds native HTML buttons over the original SVG mouse schematic. Protocol IDs come from `src/buttons.mjs`; displayed numbers are ID + 1. `app.mjs` keeps one action editor per input in the DOM, shows only the selected one, and preserves pending selections when switching. The target dropdown is an accessible alternative to clicking the map. `mouse-map.css` supplies desktop and narrow layouts. The original header CSS mouse is replaced with the same SVG schematic. Asset provenance is in `public/assets/README.md`.

Browser checks verified all 11 hotspots, DPI/DIY target selection, shortcut editing, state preservation across target switches, no horizontal overflow at the desktop breakpoint, and the updated header illustration. No hardware settings were applied during these UI checks.

The original `rapoo-re/` tree and `_toolchain/` runtime binaries are git-ignored; track app source, documentation and parser scripts. `research/generated/` is regenerable and ignored because the disassembly is large. Keep captures and proprietary binaries separately when sharing the app.

## Interface preferences and quick actions

`public/preferences.js` applies the saved theme before CSS loads, defaulting to the OS appearance. `public/polish.css` contains the compact layout and dark palette. `app.mjs` saves successful DPI profiles locally, renders one-click stage buttons, and keeps custom values under a disclosure. Startup opens the known Mac receiver but sends no setting writes. Explicit Developer preview mode suppresses writes; leaving Developer mode resets that option. Developer mode itself is session-only, available in Settings or with Cmd/Ctrl+Shift+D. Diagnostics remain in memory while their UI is hidden.

Browser verification covered light/dark appearance, default-hidden diagnostics, explicit Apply action visibility, and one-click DPI command generation in preview mode. No hardware settings were changed during these interface checks. Windows has the shared frontend, launcher and WebHID transport, but no native HID bridge or fixed-line scroll helper; it remains untested on actual Windows hardware.

## Release boundary

The app server now reads `app/data/protocol-fixture.json`, not the original capture. Protocol tests rebuild a synthetic USBPcap container from that stripped fixture. Original captures/DLLs are needed only by the research scripts. `scripts/package-release.mjs` uses an explicit allowlist, excludes the unused vendor photo, and keeps complete Node licenses alongside each included runtime. See FILES.md and PUBLISHING.md for complete package contents and rebuild steps.

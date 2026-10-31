# Development

Edit the source in this workspace; generated installers and app bundles are copies. No npm install is needed. Browser development is still available with `sh start-macos.command` or `start-windows.cmd`; only these developer entry points use a terminal. Installed apps use their native windows.

## Layers

- `app/public/`: shared HTML/CSS and browser modules. Save and reload to see UI changes.
- `app/src/protocol.mjs`, `buttons.mjs`, `polling.mjs`: pure report encoders and validators. Mac and Windows share the same bytes.
- `app/server.mjs`: loopback assets, fixture and same-origin/session-token native operation API. Restart after server changes.
- `app/native/macos-hid.mjs`: direct system HID calls through portable Node FFI.
- `packaging/windows/HidBridge.cs`: native output-report bridge compiled into `app/native/windows-hid.exe` only in Windows packages.
- `packaging/macos/main.swift`: AppKit/WKWebView window and child lifecycle.
- `packaging/windows/Launcher.cs`: WinForms/WebView2 window and hidden child lifecycle.
- `scripts/desktop-server.mjs`: owned local service on 127.0.0.1:8765, monitors parent liveness. Closing the app terminates its child. No external browser is launched.

Windows WebHID remains a source/browser fallback when no native helper is present. Packaged Windows uses its native helper because the embedded view must not depend on WebHID availability. The native bridge matches VID/PID and a BA output value-cap layout of 248 bits, then sends a full 32-byte output report with HidD_SetOutputReport. It does not register input callbacks.

## Settings

The 0x638 DPI block is unchanged. Button input addresses remain 0x600 + ID * 4. Polling at 0x630 uses equal rate bytes and the captured ff ff tail; see research/POLLING-RATE.md. No startup write is performed. Device values are not read back. The fixed-line scrolling feature, endpoints and helper have been removed; ordinary wheel action assignment remains.

## Tests

```sh
sh test-macos.command
```

Tests use the stripped fixture and synthetic USBPcap reconstruction, plus real HID descriptor fixtures and mocked native API calls. New polling tests compare captured reports exactly and reject unsupported rates or malformed writes. Windows-native mocked server tests exercise session protection and output dispatch. Removal tests ensure old scrolling endpoints are unavailable. No automated tests change the physical mouse.

The Mac executable accepts `--self-test` for bundle layout and `--smoke-test` to launch its actual embedded interface and quit after checking six DPI stages, four polling options and no scrolling section. The Windows GUI has equivalent flags, and its separate HID helper has a structure-layout self-test and read-only enumeration check. A desktop window smoke test also checks that its local child exits.

Builds stay under dist/. Personal documentation stays under personal/ and is ignored locally. The original Rapoo inputs and generated disassembly remain for future research. Only minimal labeled portable build runtimes remain.

## Local working preview

See [local testing](LOCAL-TESTING.md). The generated `preview/OpenRapoo Preview.app` reads this workspace directly on port 8760. Command+R reloads frontend changes; quit/reopen after server changes. The installed release keeps its bundled resources on port 8765. Nord-style slate/blue/lilac colors replace the green dark theme. Build-only workflow runs can validate packages before a release is approved.

The optional native Mac measurement compiles `app/native/macos-rate.swift` into the local build cache (or into a Mac package). Its authenticated six-second API returns timing summaries only; while measuring, writes and concurrent measurements are refused. The helper validates the exact known mouse descriptor and listens only to that interface. Input Monitoring permission may be required. This measures observed movement-report timing, not device configuration readback.

## Battery and icon working changes

The header shows the mouse-reported battery percentage. The fixed `BA A5 AA` query and three-byte reply are documented in `research/BATTERY.md`. Reads are token protected, serialized against measurements/writes, briefly cached, and refreshed on connection/every visible minute. Unavailable values are shown as unavailable. Windows source includes the native query, pending physical validation.

Edit `app/public/assets/app-icon.svg` for app artwork, then run the portable Node with `scripts/build-icons.mjs` on this Mac. It uses only existing Apple tools. Rebuild the local preview to update its bundled ICNS. Windows compilation embeds the generated ICO, and setup uses the same icon.

## Runtime cleanup

The packet table is built lazily when Developer mode is first opened. Logs and capture data remain available, while normal startup avoids creating the hidden explorer rows. Unused styles for the old CSS mouse drawing, old DPI inputs and removed capture tiles have been removed.

Source archives retain tests and research tools. Desktop bundles select executable app modules/assets only, omit test files/native Swift source and research scripts, and compile their platform helpers into the staged bundle. Windows bundles omit the unused Mac HID source. The portable Node runtime remains required; no runtime-size claim is inferred from the smaller source selection.

## Primary-click protection

Left (input 0) and Right (input 2) action/shortcut fields are locked until explicitly unlocked. Switching inputs, resetting selection or successfully applying/previewing relocks them. The default left/right click report is always allowed for recovery. `requiresPrimaryClickConsent()` classifies non-default primary-click reports; the shared send path requires consent before connecting/sending, and the native API separately requires a boolean `confirmPrimaryClick: true` on that request. This prevents accidental editor changes and bypass through captured-write replay. It is an intent check, not a guarantee that another click remains assigned or an assertion of current device state. The searchable action picker keeps a hidden select as the encoder source of truth; it supports arrow keys, Escape, search and keyboard selection.

## Responsive interface and native appearance

Type and spacing use rem units with a fluid 16–21px root at Automatic size. The browser's CSS viewport respects operating-system display scaling and zoom; it does not guess physical monitor DPI. Settings → Interface size provides larger persisted sizes, applied before paint. The assignment section uses container queries and a shared action footer, keeping the map/editor/actions cohesive as the window changes size.

The header receiver badge distinguishes detection from an opened receiver session. Its connected state is a transport session, not continuous physical-presence telemetry. The lightning symbol decorates a mouse-reported battery percentage and is not a charging-status claim.

`appearance.mjs` posts only a light/dark message. Native hosts validate the local page origin and the theme; no new device operations are exposed. AppKit keeps the real title bar/traffic-light controls, using an explicit appearance and matching background. Windows keeps its system frame and applies DWM dark mode/caption colors where supported, falling back to system framing on older versions. Windows also opts into per-monitor DPI awareness before constructing any windows.

Mac smoke checks require the native appearance to match the page theme. Source tests cover native-message routing and browser fallback. Browser QA can use a mocked receiver without hardware writes; mock battery/connection screenshots must be labeled as simulations. Windows compilation and visual appearance still require a Windows build/test for these changes.

Platform references: [Apple native title-bar transparency](https://developer.apple.com/documentation/appkit/nswindow/titlebarappearstransparent), [Microsoft DWM window attributes](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwmwindowattribute).

## macOS permission onboarding

The native host checks `IOHIDCheckAccess(kIOHIDRequestTypeListenEvent)` before starting its child. If permission is missing, the UI shows help and skips automatic connection; a native sheet offers Open Input Monitoring / Not Now. Only clicking Open Input Monitoring calls `IOHIDRequestAccess` and opens the matching System Settings pane. The user enables access and restarts the app. Smoke tests never request permissions or show permission dialogs. The permission-required flag is informational startup state, not a grant; native HID access remains protected by macOS.

Main-branch pushes now build/test Mac and Windows and upload artifacts. The publication job runs only for a v-prefixed tag push or a manual nonempty release tag.

## Typography

`fonts.css` pairs DM Serif Display (regular/italic headings) with DM Sans (variable-weight controls/body). Three Latin WOFF2 subsets add about 86 KB, with OFL licenses and provenance under `app/public/assets/fonts/`. All font URLs are local whitelisted routes; runtime use needs no Google Fonts connection or OS font installation. Keep diagnostic byte displays monospaced and numeric controls tabular. The CLI release/build path is documented in PUBLISHING.md; only this checkout's Git identity is configured, using the GitHub handle/noreply address.

# Rapoo Local

A lightweight desktop manager for the Rapoo MT760L and its 2.4 GHz receiver. Version **0.2.0** has its own application window on macOS and Windows. No Terminal, command window or external browser is needed for normal use. Closing the window stops the app's local service.

## Install

- **Mac Apple Silicon:** open the `.dmg`, drag **Rapoo Local** to **Applications**, then open it. macOS 14+ target. The app bundles its portable runtime and uses the system WebKit view.
- **Windows x64:** run `Rapoo-Local-0.2.0-windows-x64-setup.exe`, then open **Rapoo Local** from Start. Setup is per-user and includes uninstall support. It adds Microsoft's WebView2 runtime only if missing; that step needs internet. Node and the native HID bridge are bundled.

The packages are unsigned previews. macOS Input Monitoring permission may be required for Rapoo Local or its bundled runtime to access the receiver. Follow the displayed access error and restart the app after changing permission yourself. The app does not grant permissions or install a driver automatically.

## Mouse settings

- **DPI:** click a stage to apply immediately, or expand Customize stages to edit the six-stage profile.
- **Buttons:** click one of the 11 controls on the mouse photo, select an action and click Apply action.
- **Polling rate:** click **125 / 250 / 500 / 1000 Hz** to apply. The mapping comes from the original DLL and capture. The selected rate is not live readback or a measured frequency.
- **Dark/light mode:** saved locally in the app's webview profile.
- **Developer mode:** Settings or Cmd/Ctrl+Shift+D reveals packets, command previews and activity logs. Explicit Preview writes only suppresses writes; leaving Developer mode resets it.

The previous fixed-line scrolling feature and its native interception helper have been removed. Wheel-button assignments remain available as normal mouse actions. The earlier product photo is restored in the header and button map, with attribution in `app/public/assets/README.md`.

The app displays a saved DPI profile and suggested button defaults, not values read from the device. A DPI write sends the complete profile block. Applying after Disconnect reconnects automatically; disconnecting does not enable preview mode.

## Compatibility and validation

The user confirmed the earlier Mac and Windows packages work with this receiver (`24ae:1870`). The new desktop release adds native Windows HID access to support the embedded view, and the new polling selector still needs a physical check. Build tests and window smoke tests do not establish every physical action's effect. Bluetooth, other mouse models and Intel Mac are not verified.

Mac HID uses portable Node 26.4 FFI with system IOKit/CoreFoundation. Windows desktop HID uses the bundled C# bridge and Windows HID APIs, with descriptor validation for output report BA/31 payload bytes. No scrolling event tap or keyboard input listener is installed.

## Source and builds

The editable interface has no npm dependencies or frontend build step. The existing two portable runtimes are under `_toolchain/portable-node-macos-arm64/` and `_toolchain/portable-node-windows-x64/`. Developer browser launchers remain source-only; they are not required by installed apps.

```sh
sh test-macos.command
_toolchain/portable-node-macos-arm64/node scripts/package-release.mjs source
_toolchain/portable-node-macos-arm64/node scripts/package-release.mjs macos-arm64
```

Build the Windows target on Windows or GitHub Actions, where its native window, HID helper and installer are compiled. A Mac build uses an already available Apple compiler and system disk-image utility, without installing tools. GitHub's Windows runner supplies the existing .NET compiler and Inno Setup; WebView2 SDK files are fetched into that builder's toolchain folder, not installed on the Mac.

Every archive has a SHA-256 sidecar and per-file manifest. The Mac target produces `.app.zip` contents and a drag-install `.dmg`; the Windows target produces a portable desktop ZIP and a setup executable. See [build instructions](docs/PUBLISHING.md), [file guide](docs/FILES.md), [development notes](docs/DEVELOPMENT.md) and [polling evidence](research/POLLING-RATE.md).

Original vendor executables/capture, generated research, personal notes and unused analysis tools are not app dependencies. Personal notes remain outside the packager's selected folders. This is an unofficial project; source is MIT licensed with separate Node/WebView2 licensing and product-photo attribution in [third-party notices](THIRD_PARTY_NOTICES.md).

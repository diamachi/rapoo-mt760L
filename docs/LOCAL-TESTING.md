# Test changes without reinstalling

Open `preview/OpenRapoo Preview.app` directly in Finder. It is a small local app window that serves the working source in this project. It is not installed into Applications, and it does not create or update a GitHub release.

- UI changes in `app/public/`: save, then press Command+R in the preview window. The same live UI is available at http://127.0.0.1:8760/ while the preview app is running.
- Backend/module changes used by `app/server.mjs`: quit the preview with Command+Q and reopen it.
- Native Swift changes: rebuild the preview with the portable runtime using `scripts/build-preview.mjs`, then reopen. Normal UI work does not need rebuilding.
- Keep the installed app closed while testing mouse writes so two app copies do not compete. The local preview has its own browser profile, so theme and DPI profile choices can differ from the installed app.

To recreate the preview after moving this project, run once from the project root:

```sh
_toolchain/portable-node-macos-arm64/node scripts/build-preview.mjs
```

This uses the existing Apple compiler and local Node runtime. Nothing is installed globally. The preview's Info.plist records the absolute workspace location. Do not distribute this development app: it depends on this folder.

## Check the polling selector

1. Use the MT760L's 2.4 GHz connection, not Bluetooth, and select 125 Hz.
2. Click **Measure actual reports · 6 seconds** and move the mouse continuously in circles for the entire test. Repeat after selecting 250, 500 and 1000 Hz.
3. Compare median intervals: roughly 8, 4, 2 and 1 ms respectively. The UI shows the active mean and interval spread too. Large variation or sparse movement requires another measurement.

The native Mac test reads only the matching receiver's known mouse report interface, in shared mode, for six seconds. It retains timestamps only, sends no output reports, captures no keyboard input, and stops automatically. Pauses over 50 ms and intervals under 0.25 ms are excluded; fewer than 100 usable intervals produces no estimate. This is an estimate of observed moving-report arrival timing, not firmware readback or proof of USB bus polling frequency. It is currently a Mac-only diagnostic.

If macOS denies access, open System Settings → Privacy & Security → Input Monitoring and allow **OpenRapoo Preview** (or its runtime if macOS lists that separately), then quit and reopen the preview. Permissions are never enabled automatically. If another app name appears in a permission prompt, verify it is the preview/runtime before allowing it.

A web tracker can measure browser-dispatched events rather than all device reports. Chrome combines continuous input around display frames: https://developer.chrome.com/blog/aligning-input-events/ . A flat 120 Hz result alone therefore does not establish whether a rate command worked. Rapoo advertises up to 1000 Hz for the 2.4 GHz connection: https://shop.rapoo.com/products/rapoo-mt760-multi-device-wireless-mouse . Hardware/firmware behavior must still be checked on this receiver.

On 2026-10-31, the owner tested the native measurement after enabling access and reported correct values. The preview visibly showed a 250 Hz request with 4.00 ms median, 250 Hz active mean and 1508 usable intervals. The following 500 Hz test showed a 2.00 ms median and 499 Hz active mean across 3034 intervals. No additional release was published.

If all native measurements remain near 125 Hz, record each requested rate and result in Developer tools → Activity log. That would justify investigating receiver/firmware limits or command readback. Do not treat a successful send as a verified rate change.

## Release rule

Check the working preview and platform packages first. A release is published only after you explicitly approve it. The local workflow now builds artifacts only; this change has not been pushed to GitHub. Your private handbook stays local.

## Battery percentage and app icon

Battery reads run on connection and each visible minute; use the refresh arrow beside the percentage for a manual refresh. The fixed query asks for battery status and changes no mouse settings. The mouse currently reported 76%. “Battery unavailable” means no valid current reply, not zero battery. The current short cache is 15 seconds; the hover text shows when the reading was taken.

The preview has a new original mouse-shaped app icon, also used for the favicon/header logo. The Mac ICNS and Windows ICO are built from `app/public/assets/app-icon.svg`. To change it, edit the SVG, run `scripts/build-icons.mjs` with portable Node on this Mac, and rebuild the preview. These changes remain local pending your testing and approval.

The Dock/taskbar follow-up sets the Mac application icon explicitly at launch. Windows uses the embedded mouse ICO and a stable AppUserModelID shared with installer shortcuts so the running taskbar entry groups with its shortcut. This follow-up is included in the source after f2a40b1; Windows visual verification is pending. Publishing an app release still requires separate owner approval.

## Left/right click assignments

These two action dropdowns start locked. Tick the explicit unlock checkbox, choose an action, then Apply. Switching controls or a successful apply/preview clears the unlock again. A non-default primary assignment cannot be sent without explicit consent; the native API checks it too. Reset selection chooses the standard action; Apply restores that standard click without requiring unlock. Keep another way to click available when intentionally remapping a primary button.

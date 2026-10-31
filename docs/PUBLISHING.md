# Desktop builds and publication

Version 0.2.0 replaces the terminal launchers used in the first preview with native desktop windows. The previous Mac and Windows packages were hardware-tested; the new native Windows transport needs its own hardware validation. Native Mac measurements showed the expected polling intervals.

## Local Mac build

Use the portable runtime from the project root. Existing Apple command-line tools provide swiftc; nothing is installed by the build.

```sh
sh test-macos.command
_toolchain/portable-node-macos-arm64/node scripts/package-release.mjs source
_toolchain/portable-node-macos-arm64/node scripts/package-release.mjs macos-arm64
```

The Mac target compiles AppKit/WKWebView code, embeds the portable Node executable and its license, creates a manifest/ZIP, and creates a DMG with an Applications shortcut. The app starts the local service with hidden output; the window owns its lifetime. It never opens Terminal or an external browser. Copying into Applications is the user's install action; the build does not install the app on this Mac.

The builder refuses an existing staging folder. Bump the app/package.json version and matching Info.plist version, or move all previous outputs for the same version aside before rebuilding. Don't put notes or secrets inside app/, scripts/ or packaging/: those selected trees are gathered recursively. personal/ is outside the archive selection.

## Windows build

Run the Windows target on a Windows builder:

```bat
_toolchain\portable-node-windows-x64\node.exe scripts\package-release.mjs windows-x64
```

The existing .NET Framework compiler builds a WinForms/WebView2 GUI executable and a small HID command helper. The builder fetches pinned Microsoft WebView2 SDK files into its local toolchain cache and retains their license with the app. The Windows runner's existing Inno Setup creates a per-user setup executable and Start-menu entry, with normal uninstall support.

The setup bundle includes Microsoft's signed WebView2 bootstrapper; installation checks the official registry version keys and adds the Evergreen runtime only if missing. That download requires internet only when the runtime is absent. The app itself uses the bundled portable Node runtime and Windows system HID libraries. No console or external browser appears during normal operation.

## GitHub Actions

The workflow builds on macos-15 arm64 and windows-2025 x64 when manually dispatched or when a v-prefixed tag is pushed. It tests source, packages each desktop app, runs window smoke tests and publishes build artifacts. The Mac artifact includes source ZIP, app ZIP, DMG and checksums. The Windows artifact includes desktop ZIP, setup EXE and checksums. Artifacts wrap the inner release files, so extract the artifact ZIP before attaching downloads to a release.

The workflow publishes after both platform builds and desktop/install checks pass. Deliberately push a matching v-prefixed version tag, or run the workflow manually with `release_tag` (for example `v1.0.0`). Leave that input empty for build artifacts only. Ordinary main pushes do not publish. A hyphenated tag produces a prerelease. Existing releases are not overwritten. The publishing job alone has contents write permission; checksums and required installers are verified before publication. The owner must approve publication first. Repository visibility is never changed, and personal documentation is excluded.


## Validation before release

1. Run source tests, then test the extracted app/window and verify closing it stops its child.
2. Compare every distributed file with its .sha256 sidecar; verify internal MANIFEST.json hashes.
3. Physically test polling/DPI/button effects with the receiver on each OS. Native Windows behavior is new in 0.2.0 even though the earlier WebHID package worked.
4. Verify Windows setup, Start-menu launch and uninstall. Verify Mac drag-install and OS HID permission prompts.
5. Publish tested outputs only after explicit approval. These packages remain unsigned; Signing/notarization requires a separate setup.

Official API references: Microsoft WebView2 distribution https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution and HID output reports https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/hidsdi/nf-hidsdi-hidd_setoutputreport .

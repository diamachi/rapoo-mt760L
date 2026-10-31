# Source file guide

This lists the files selected for the OpenRapoo source package. Installed apps use native windows with hidden, owned local services; developer scripts are separate.

| File | Purpose |
| --- | --- |
| `README.md` | Current installation, features and validation scope for OpenRapoo. |
| `LICENSE` | MIT license for original project source; points out separate Node licensing and excluded vendor material. |
| `THIRD_PARTY_NOTICES.md` | Node and WebView2 licensing, restored photo attribution and excluded original research inputs. |
| `.gitignore` | Excludes original inputs, portable runtimes, generated disassembly, logs, OS metadata and dist archives from Git. |
| `.github/workflows/release.yml` | Builds native desktop windows, runs tests/window lifecycle checks and creates Mac DMG/Windows setup artifacts; publishes only on an explicit release tag or manual release request. |
| `start-macos.command` | Selects the bundled runtime for the Mac architecture and starts the browser launcher. |
| `start-windows.cmd` | Runs the bundled Windows Node runtime; portable fallback when no compiled launcher is available. |
| `start-linux.sh` | Source-only Linux launcher; requires a separately supplied portable runtime. |
| `test-macos.command` | Runs the Node test suite using the local portable Mac runtime. |
| `docs/FILES.md` | This exhaustive source-file guide and generated package layout. |
| `docs/PUBLISHING.md` | Native Mac/Windows package builds, installer behavior and GitHub workflow. |
| `docs/DEVELOPMENT.md` | Current architecture, source workflow, native lifecycle and polling tests. |
| `research/PROTOCOL.md` | Report evidence, memory addresses, transfer semantics, confidence and unknown readback behavior. |
| `research/BUTTONS-AND-SCROLL.md` | Historical button/scroll research; fixed-line scrolling was removed in 0.2.0. |
| `research/POLLING-RATE.md` | DLL addresses, constructor rate mapping, captured report cross-checks and validation limits. |
| `app/data/protocol-fixture.json` | Stripped 107-transfer protocol fixture for startup, developer explorer and synthetic parser tests; excludes host metadata and raw capture. |
| `app/native/macos-hid.mjs` | Native receiver discovery, descriptors, probe and BA output reports through IOKit/CoreFoundation using Node FFI. |
| `app/package.json` | Project identity/version and optional Node script aliases; no npm dependencies. |
| `app/public/appearance.mjs` | Sends a validated light/dark theme to the native window hosts. |
| `app/public/fonts.css` | Offline DM Sans/DM Serif Display faces, editorial headings and italic headline accent. |
| `app/public/assets/fonts/` | Bundled Latin WOFF2 subsets, upstream OFL licenses and provenance/hashes. |
| `app/public/layout.css` | Fluid root sizing, scalable layout, receiver/lightning icons, container queries and shared assignment footer. |
| `app/test/appearance.test.mjs` | Mac/Windows appearance-message routing, invalid theme rejection and browser fallback. |
| `app/public/action-picker.mjs` | Searchable action menu, grouped choices, keyboard navigation and primary-lock synchronization. |
| `app/public/app.mjs` | UI behavior, local DPI profile, theme toggle, action selection, writes/previews, logs and native/WebHID transport choice. |
| `app/public/assets/README.md` | Product photo provenance and copyright attribution. |
| `app/public/assets/mt760l.webp` | Restored original Rapoo MT760L product photo; separately attributed, not covered by the source MIT license. |
| `app/public/controls.css` | Button/shortcut control styles. |
| `app/public/index.html` | Accessible application structure: connection, DPI, visual buttons, polling and native rate test, theme and hidden developer tools. |
| `app/public/mouse-map.css` | Hotspot map, action panel and responsive layouts. |
| `app/public/mouse-map.mjs` | Builds 11 selectable hotspots and side/underside callouts on the mouse schematic. |
| `app/public/polish.css` | Compact controls, quick DPI cards, developer visibility and dark palette overrides. |
| `app/public/preferences.js` | Applies saved/system appearance before rendering to reduce theme flashing. |
| `app/public/style.css` | Base typography, navigation, cards and overall layout. |
| `app/server.mjs` | Protected loopback server serving the shared UI and stripped fixture; dispatches native Mac/Windows operations with Origin/session/probe validation. |
| `app/src/buttons.mjs` | 11 input definitions, supported actions/keyboard usages, four-byte action encoders and backend write allowlist. |
| `app/src/hid-descriptor.mjs` | Parses HID report descriptors to locate compatible vendor output reports. |
| `app/src/native-client.mjs` | Shared browser client for native Mac and Windows HID bridges. |
| `app/src/polling.mjs` | Evidence-backed 125/250/500/1000 Hz encoder and strict validation of the 0x630 rate block. |
| `app/src/protocol.mjs` | Pure report parsing, hex helpers, DPI validation/encoding and captured write identification. |
| `app/src/transport.mjs` | Chrome/Edge WebHID receiver selection, BA payload splitting, writes and disconnect handling. |
| `app/test/buttons-polling.test.mjs` | Captured polling-rate goldens, malformed rate rejection, all 11 button targets and action encoding checks. |
| `app/test/hid-descriptor.test.mjs` | Real descriptor parsing and exclusion of non-configuration receiver interfaces. |
| `app/test/protocol.test.mjs` | Synthetic PCAPNG reconstruction/parser checks, DPI byte goldens/validation, WebHID splitting and incompatible-device rejection. |
| `app/test/server.test.mjs` | HTTP routes, origin/token/host protections, receiver probe-before-write, protected rate measurement and concurrent-write exclusion. |
| `scripts/decode-capture.mjs` | Dependency-free USBPcap/PCAPNG parser; raw-capture CLI needs separately supplied original input. |
| `scripts/desktop-server.mjs` | Desktop-owned background service; monitors its parent and exits after window/app shutdown without starting a terminal or browser. |
| `scripts/evidence.mjs` | Research-only capture/binary hashes, PE exports and evidence summaries from separately supplied local vendor inputs. |
| `scripts/extract-profile-candidates.mjs` | Research-only extraction of compressed candidate button/profile resources from supplied A HUB.exe. |
| `scripts/fetch-runtime.mjs` | Local/CI pinned Node archive download/verification, into labeled minimal platform runtime folders. |
| `scripts/inspect-disassembly.mjs` | Research-only address-based disassembly annotations; requires local RapooDevice.dll and generated disassembly. |
| `scripts/launch-app.mjs` | Source-only developer browser launcher; not used by installed desktop apps. |
| `scripts/package-release.mjs` | Stages native desktop apps, compiles platform windows/helpers, packages ZIP/DMG/setup and creates file manifests/checksums. |
| `packaging/macos/Info.plist` | Desktop Mac app identity, version, minimum OS and executable entry point. |
| `packaging/macos/main.swift` | Native AppKit/WKWebView app window, menus, local-only navigation, export save panel and owned child lifecycle; includes self/smoke checks. |
| `packaging/windows/HidBridge.cs` | Windows HID enumeration, BA descriptor validation, probe/output reports and structure-layout self-test; no input listeners. |
| `packaging/windows/Launcher.cs` | Native WinForms/WebView2 app, hidden service lifecycle, app profile and singleton handling; includes self/smoke checks. |
| `packaging/windows/build-launcher.ps1` | Windows-only SDK fetching, GUI/HID compilation, license copying and Microsoft bootstrapper signature verification. |
| `packaging/windows/installer.iss` | Per-user Windows setup/uninstall, Start menu/optional desktop shortcut and WebView2 installation only when missing. |

| `AGENTS.md` | Persistent project instructions: local testing, explicit release approval, portable tools and private handbook exclusion. |
| `docs/LOCAL-TESTING.md` | Click-to-open local preview, reload workflow, native report measurements and permission instructions. |
| `app/native/macos-rate.swift` | Six-second, read-only mouse HID timestamp sampler; no keyboard interface or settings writes. |
| `app/src/rate-stats.mjs` | Summarizes observed report intervals, excludes pauses/outliers and refuses insufficient samples. |
| `app/test/rate-stats.test.mjs` | Synthetic 125/250/500/1000 Hz timing, pause/outlier rejection and insufficient-movement checks. |
| `scripts/build-preview.mjs` | Builds the local Mac preview and measurement helper using existing Apple tools; binds the window to this workspace. |

| `app/src/battery.mjs` | Strict mouse-reported battery reply decoder; never estimates an unavailable percentage. |
| `app/test/battery.test.mjs` | Live-reply golden, 0/100 boundaries, padded replies and invalid status/length/value rejection. |
| `research/BATTERY.md` | Battery query/reply evidence, live 76% reading and platform validation limits. |
| `app/public/assets/app-icon.svg` | Original ergonomic mouse icon in the Nord-style app palette; source for all icon formats. |
| `packaging/assets/AppIcon.icns` | Generated multiresolution Mac application icon. |
| `packaging/assets/app-icon.ico` | Generated multiresolution Windows executable/setup icon. |
| `packaging/assets/app-icon-1024.png` | Generated 1024px PNG icon preview. |
| `scripts/build-icons.mjs` | Rebuilds icon formats locally using existing AppKit, sips and iconutil. |
| `scripts/render-icon.swift` | Renders the SVG source to a transparent PNG with AppKit. |

## Generated and preserved local files

Mac app bundles contain their native executable, shared app/resources and matching portable Node runtime/license. Windows bundles additionally contain compiled windows-hid.exe, WebView2 loader/assemblies and SDK license. Mac DMG and Windows setup provide normal install flows. Each archive has an internal manifest and adjacent SHA-256 sidecar.

Original rapoo-re inputs, generated research and personal notes remain local and excluded from packages. Desktop runtime packages additionally exclude app tests, native Swift source, Windows-side Mac HID source, and research scripts; the source ZIP retains them. README images live in docs/screenshots/ and travel with source documentation. Desktop bundles retain license notices and a short installation README, rather than source/research guides and screenshots. Local upload/release proof images are archived under docs/archive/. Only the two minimal Node runtimes and a regenerable build cache remain in the local toolchain. Generated build outputs and caches remain local.

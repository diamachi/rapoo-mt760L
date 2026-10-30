# Source file guide

This lists every file included in the source ZIP. The original research inputs and portable runtimes are separate; the application does not need those original inputs to run.

| File | Purpose |
| --- | --- |
| `.gitignore` | Excludes original inputs, portable runtimes, generated disassembly, logs, OS metadata and dist archives from Git. |
| `.github/workflows/release.yml` | Manual/tag-triggered GitHub Mac and Windows builds; tests, runtime verification and downloadable ZIP artifacts. Never changes visibility or publishes automatically. |
| `README.md` | User instructions, features, platform status, permissions and links to detailed documentation. |
| `LICENSE` | MIT license for original project source; points out separate Node licensing and excluded vendor material. |
| `THIRD_PARTY_NOTICES.md` | Runtime licensing, trademark attribution, fixture provenance and excluded proprietary material. |
| `start-macos.command` | Selects the bundled runtime for the Mac architecture and starts the browser launcher. |
| `start-windows.cmd` | Runs the bundled Windows Node runtime; portable fallback when no compiled launcher is available. |
| `start-linux.sh` | Source-only Linux launcher; requires a separately supplied portable runtime. |
| `test-macos.command` | Runs the Node test suite using the local portable Mac runtime. |
| `app/package.json` | Project identity/version and optional Node script aliases; no npm dependencies. |
| `app/server.mjs` | Loopback-only HTTP server, asset allowlist, protocol fixture endpoint, app identity endpoint, native operation authorization and write validation. |
| `app/scroll-service.mjs` | Supervises the optional scroll helper child, validates settings and handles shutdown. |
| `app/data/protocol-fixture.json` | Stripped 107-transfer protocol fixture for startup, developer explorer and synthetic parser tests; excludes host metadata and raw capture. |
| `app/native/macos-hid.mjs` | Native receiver discovery, descriptors, probe and BA output reports through IOKit/CoreFoundation using Node FFI. |
| `app/native/macos-scroll.mjs` | Optional raw-wheel input/event-tap helper and isolated native self-tests; no permanent OS preference changes. |
| `app/src/protocol.mjs` | Pure report parsing, hex helpers, DPI validation/encoding and captured write identification. |
| `app/src/buttons.mjs` | 11 input definitions, supported actions/keyboard usages, four-byte action encoders and backend write allowlist. |
| `app/src/scroll.mjs` | Pure line-count validation and raw wheel delta conversion. |
| `app/src/hid-descriptor.mjs` | Parses HID report descriptors to locate compatible vendor output reports. |
| `app/src/transport.mjs` | Chrome/Edge WebHID receiver selection, BA payload splitting, writes and disconnect handling. |
| `app/src/native-client.mjs` | Browser client for the local Mac bridge, session token and receiver operations. |
| `app/public/index.html` | Accessible application structure: connection, DPI, visual buttons, scrolling, theme and hidden developer tools. |
| `app/public/app.mjs` | UI behavior, local DPI profile, theme toggle, action selection, writes/previews, logs and native/WebHID transport choice. |
| `app/public/preferences.js` | Applies saved/system appearance before rendering to reduce theme flashing. |
| `app/public/style.css` | Base typography, navigation, cards and overall layout. |
| `app/public/controls.css` | Button/shortcut and scrolling control styles. |
| `app/public/mouse-map.css` | Hotspot map, action panel and responsive layouts. |
| `app/public/polish.css` | Compact controls, quick DPI cards, developer visibility and dark palette overrides. |
| `app/public/mouse-map.mjs` | Builds 11 selectable hotspots and side/underside callouts on the mouse schematic. |
| `app/public/assets/mouse.svg` | Original MIT-licensed vector mouse illustration used in the header and map. |
| `app/public/assets/README.md` | Illustration provenance and explanation that the older manufacturer photo is unused/excluded. |
| `app/test/protocol.test.mjs` | Synthetic PCAPNG reconstruction/parser checks, DPI byte goldens/validation, WebHID splitting and incompatible-device rejection. |
| `app/test/buttons-scroll.test.mjs` | All input addresses, captured button golden, action encodings/validation, raw scroll counts and isolated Mac native checks. |
| `app/test/hid-descriptor.test.mjs` | Real descriptor parsing and exclusion of non-configuration receiver interfaces. |
| `app/test/server.test.mjs` | HTTP routes, origin/token/host protections, receiver probe-before-write and mock scroll lifecycle. |
| `scripts/launch-app.mjs` | Starts/reuses the loopback app, opens the browser and shuts down on terminal signals. |
| `scripts/package-release.mjs` | Explicitly stages source/Mac/Windows files, copies matching runtime licenses, optionally compiles Windows launcher, generates manifests and ZIP/SHA-256 files. |
| `scripts/fetch-runtime.mjs` | GitHub builder utility downloading pinned portable Node archives from nodejs.org and verifying their distribution SHA-256; not run on the user Mac. |
| `scripts/decode-capture.mjs` | Dependency-free USBPcap/PCAPNG parser; raw-capture CLI needs separately supplied original input. |
| `scripts/evidence.mjs` | Research-only capture/binary hashes, PE exports and evidence summaries from separately supplied local vendor inputs. |
| `scripts/extract-profile-candidates.mjs` | Research-only extraction of compressed candidate button/profile resources from supplied A HUB.exe. |
| `scripts/inspect-disassembly.mjs` | Research-only address-based disassembly annotations; requires local RapooDevice.dll and generated disassembly. |
| `packaging/macos/Info.plist` | Mac app identity, version, architecture-era OS target and launcher entry point. |
| `packaging/macos/RapooLocal` | Mac app shell entry point; opens the bundled start command in Terminal without installing a service. |
| `packaging/windows/Launcher.cs` | Windows console .exe source wrapping the bundled runtime, with packaging self-test. |
| `packaging/windows/build-launcher.ps1` | Compiles the Windows launcher using the existing Windows .NET Framework compiler; never runs on the Mac. |
| `docs/FILES.md` | This exhaustive source-file guide and generated package layout. |
| `docs/PUBLISHING.md` | Local rebuilding, private GitHub publication, Actions builds, checksums and later public sharing. |
| `docs/DEVELOPMENT.md` | Architecture notes, development commands and remaining reverse-engineering work. |
| `research/PROTOCOL.md` | Report evidence, memory addresses, transfer semantics, confidence and unknown readback behavior. |
| `research/BUTTONS-AND-SCROLL.md` | Recovered input/action encodings, evidence landmarks, alternate profile mapping and scroll design. |

## Generated application packages

- **Mac:** `Rapoo Local.app/Contents/Info.plist` identifies the app; `Contents/MacOS/RapooLocal` is its executable launcher. `Contents/Resources/` contains the application, documentation, `scripts/launch-app.mjs`, `start-macos.command`, and `_toolchain/portable-node-macos-arm64/{node,LICENSE}`. The outer folder also has README, START-HERE and MANIFEST files.
- **Windows:** the application and docs are beside `_toolchain/node26/{node.exe,LICENSE}` and `start-windows.cmd`. GitHub/Windows builds also include `Rapoo Local.exe`; Mac-built Windows archives explicitly omit that executable.
- **All targets:** `MANIFEST.json` lists file sizes and SHA-256 hashes. Each ZIP has an adjacent `.sha256` sidecar. Source ZIPs exclude runtime binaries; platform ZIPs include their matching runtime. Packaging scripts/workflow are in the source ZIP, not necessary in app bundles.

## Preserved local material excluded from every archive

| Local path | Role / exclusion |
| --- | --- |
| `rapoo-re/` | Original Windows executables, DLLs and raw capture; proprietary research inputs, preserved untouched. |
| `_toolchain/` | Existing reverse-engineering tools/runtimes; source excludes all of it, app bundles copy only the matching Node executable and license. |
| `research/generated/` | Regenerable extraction/disassembly outputs; excluded. |
| `app/public/assets/mt760l.webp` | Previously cached vendor photo; unused and excluded. |
| `docs/*.png` | Local UI screenshots; excluded to avoid bundling older vendor imagery or machine state. |
| `dist/` | Generated staging trees/archives/checksums; ignored by Git and never recursively added to another archive. |

The source guide is descriptive; `scripts/package-release.mjs` enforces the archive allowlist and `MANIFEST.json` records the actual contents.

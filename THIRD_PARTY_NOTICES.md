# Third party notices

OpenRapoo is unofficial. Rapoo and MT760L trademarks belong to their owners. Original project source is MIT licensed.

## Node

Each app includes the matching portable Node runtime with its complete upstream LICENSE beside the executable. No npm packages are bundled. Node reference: https://nodejs.org/ .

## Microsoft WebView2

Windows builds use Microsoft's WebView2 Core/WinForms SDK assemblies and x64 loader, with the SDK's license retained as WebView2-LICENSE.txt in that app folder. The Windows installer includes Microsoft's signed Evergreen bootstrapper and adds the runtime only when absent. The installed runtime uses Microsoft's own license and update mechanism. Reference: https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution .

## Bundled fonts

DM Sans and DM Serif Display are supplied under the SIL Open Font License 1.1. The app bundles only Latin WOFF2 subsets and makes no runtime font requests to Google. Copyright and license texts are retained in `app/public/assets/fonts/OFL-DMSans.txt` and `OFL-DMSerifDisplay.txt`; `SOURCES.json` records source URLs, sizes and SHA-256 hashes. Font project: https://github.com/googlefonts/dm-fonts .

## Mouse photo

The restored MT760L photo is copyright Rapoo/the original owner and is not part of the MIT-licensed source artwork. Source: https://www.rapoo-eu.com/product/mt760l/ . It is cached locally; no image requests are made at runtime. See app/public/assets/README.md for the original asset URL. No redistribution license is asserted.

## Original research inputs

Vendor executables, DLLs, the raw PCAPNG, generated disassembly and original analysis tools are not distributed with the app. A stripped protocol fixture preserves configuration bytes needed by tests and the developer explorer, excluding original timestamps, IRP pointers and USB host/bus identifiers.

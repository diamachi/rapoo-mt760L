# Build and publish Rapoo Local

## What is ready locally

`dist/` contains separate versioned source, macOS arm64 and Windows x64 portable ZIPs, plus SHA-256 sidecars. Each ZIP includes a README and a `MANIFEST.json` listing file sizes and hashes. The macOS ZIP contains a real `.app` launcher bundle, the app source and portable runtime. It opens Terminal and the browser; it is not a separate native-rendered UI. The Windows ZIP made on the Mac contains `start-windows.cmd` and the Windows runtime. It does **not** contain a locally compiled Windows `.exe`.

The GitHub workflow compiles `Rapoo Local.exe` on a Windows runner using the runner's existing .NET Framework compiler, includes it in the Windows ZIP and runs a launcher self-test. This has not yet run on GitHub. Neither that test nor the protocol tests establish physical Windows mouse support.

Original vendor software, raw capture, unused vendor photo, personal paths, screenshots and reverse-engineering runtimes are excluded by an explicit source allowlist. The source package includes only original app code, docs, research notes, research scripts and the stripped protocol fixture. `.gitignore` keeps local inputs and generated archives out of the repository.

## Rebuild without installing anything on the Mac

Use the existing portable runtime from the project root:

```sh
./test-macos.command
_toolchain/portable-node-macos-arm64/node scripts/package-release.mjs source
_toolchain/portable-node-macos-arm64/node scripts/package-release.mjs macos-arm64
_toolchain/portable-node-macos-arm64/node scripts/package-release.mjs windows-x64
```

Packaging reads only local files and uses the existing system ZIP utility. It installs/downloads nothing. Staging folders are retained under `dist/` for inspection; the builder refuses to reuse an existing staging folder. Move old output aside or bump `app/package.json` before rebuilding. The Mac `.app` version also lives in `packaging/macos/Info.plist`.

To build the `.exe` on Windows with an existing suitable portable Node runtime and .NET Framework compiler:

```bat
_toolchain\node26\node.exe scripts\package-release.mjs windows-x64
```

The Windows compiler is used only on Windows; no Windows compiler is installed on the Mac. Keep the entire extracted Windows folder together.

## Create a private GitHub repository

1. Sign in to GitHub and create a repository named `rapoo-local` (or your preferred name). Choose **Private**. For a new local push, create it empty, without a generated README/license.
2. Extract the **source ZIP** and work inside its top-level folder. This provides a clean publication boundary; don't upload the entire original reverse-engineering workspace or either runtime ZIP as source.
3. Use GitHub Desktop's existing installation, or existing Git, to commit and push that extracted folder. With Git, replace `YOUR_ACCOUNT` below with your account. Authentication must be configured through your own GitHub login; don't paste tokens into source files.

```sh
git init -b main
git add .
git commit -m "Initial portable MT760L manager"
git remote add origin https://github.com/YOUR_ACCOUNT/rapoo-local.git
git push -u origin main
```

No repository was created or pushed solely by creating these local archives. GitHub account access is needed to finish publication.

## Build app artifacts on GitHub

1. In the private repo, open **Actions → Build portable apps → Run workflow**. This runs on GitHub-hosted Mac and Windows machines, not your Mac. Private-repository Actions usage is subject to your GitHub plan.
2. Both jobs obtain Node 26.4.0 from nodejs.org, check SHA-256, run source tests and build ZIPs. Windows additionally compiles/self-tests its `.exe` launcher. Node is not installed on your own Mac by this workflow.
3. Download artifacts from the workflow run. They contain the ZIPs and checksum sidecars. The Mac artifact also includes the source ZIP. Check job results before distributing.
4. Test Windows receiver access and physical DPI/button changes on actual Windows hardware. Test scrolling on the Mac. Keep the compatibility table accurate.
5. Create a **draft release** and attach the built ZIPs and `.sha256` files. Keep it a prerelease while hardware behavior remains unverified. The workflow has read-only repository permission and never publishes automatically.

Official references: [manual workflow runs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow), [workflow syntax and runners](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [artifact uploads](https://github.com/actions/upload-artifact).

## Later make it public

Leave the repository private until you choose to share it. When ready, review source/history and release artifacts, update the hardware support status, then change visibility yourself under GitHub repository **Settings → Danger Zone → Change repository visibility**. Publishing a release in a private repo does not itself make the repo public. This workflow does not change visibility.

Both apps remain unsigned. Signing/notarization credentials and Windows code-signing certificates are not configured. Public signed releases require a separate signing setup; the current archives are clearly labeled unsigned previews. Do not remove OS trust protections as part of this project.

## Verify an archive

On Mac, compare `shasum -a 256 path/to/archive.zip` with its `.sha256` sidecar. On Windows, use `Get-FileHash path\to\archive.zip -Algorithm SHA256` in PowerShell. `MANIFEST.json` provides hashes for the archive contents (the manifest itself is intentionally not self-hashed).

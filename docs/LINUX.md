# Build and test the Linux AppImage

OpenRapoo packages an **x86-64 Linux** desktop app with Electron and a small hidraw bridge. The target needs a desktop session and normal Electron system libraries (GTK, NSS, GBM and ALSA), but does not need Node, Electron or npm installed separately. ARM64 is supported as a **build host** with a cross compiler; the resulting app still runs on x86-64 Linux.

## Build on your Linux PC

From a fresh checkout:

```sh
git clone https://github.com/diamachi/rapoo-mt760L.git OpenRapoo
cd OpenRapoo
bash scripts/build-appimage.sh --docker
```

This also works with Docker Desktop on Apple silicon. The builder uses the host architecture and cross-compiles the small Linux HID bridge on ARM64; it does not execute the x86-64 app during packaging. It uses the `node:22-bookworm` base image and installs build prerequisites **inside the container**. On Linux without Docker, run `bash scripts/build-appimage.sh` with Node 22+, Bash, GCC (x86-64 cross GCC on ARM64), Linux UAPI headers, curl, unzip, sha256sum, file and desktop-file-utils available.

The script runs source tests, verifies checksums of the pinned Electron and AppImage downloads, and writes these files to `dist/`:

- `OpenRapoo-1.2.1-linux-x86_64.AppImage`
- `OpenRapoo-1.2.1-linux-x86_64.sha256`

Downloads are cached in `_toolchain/linux-appimage/`. Repeat builds reuse verified downloads. Linux GUI and receiver testing happen on the target PC.

## Run and test

1. In `dist/`, run `sha256sum -c OpenRapoo-1.2.1-linux-x86_64.sha256`.
2. Run `chmod +x OpenRapoo-1.2.1-linux-x86_64.AppImage` if the file was downloaded, then open it from the file manager or launch it with `./OpenRapoo-1.2.1-linux-x86_64.AppImage`. If FUSE is unavailable, try `APPIMAGE_EXTRACT_AND_RUN=1 ./OpenRapoo-1.2.1-linux-x86_64.AppImage`.
3. Connect the MT760L 2.4 GHz USB receiver. If Linux denies access, run this one-time setup on the **Linux PC** as your regular user:

   ```sh
   ./OpenRapoo-1.2.1-linux-x86_64.AppImage --install-udev-rule
   ```

   The rule grants the active local desktop session access to hidraw interfaces on receiver `24ae:1870`. The setup command asks for administrator approval to install the bundled rule and reload udev. Unplug and reconnect the receiver afterward. Normal launches run as your regular desktop user and never modify system permissions.

4. Confirm the receiver connects. Change one DPI stage and a non-primary button, then restore them. Try polling selection and battery refresh with the mouse awake. A successful send does not verify the effect. Built-in polling measurement is still macOS only.
5. For a window-only test without hardware access, launch the AppImage with `--smoke-test` from a terminal on a graphical session. It checks the DPI controls and exits.

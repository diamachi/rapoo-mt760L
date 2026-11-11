#!/usr/bin/env bash
# Build an x86-64 Linux AppImage natively, or with Docker on Linux/macOS.
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
out="${OPENRAPOO_OUTPUT_DIR:-$root/dist}"
cache="${OPENRAPOO_BUILD_CACHE:-$root/_toolchain/linux-appimage}"
mkdir -p "$out" "$cache"
out="$(cd -- "$out" && pwd)"
cache="$(cd -- "$cache" && pwd)"

if [[ "${1:-}" == --docker ]]; then
  [[ $# -eq 1 ]] || { echo "Usage: $0 [--docker]" >&2; exit 2; }
  docker build --build-arg "BASE_IMAGE=${OPENRAPOO_DOCKER_BASE:-node:22-bookworm}" \
    -t openrapoo-appimage-builder "$root/packaging/linux"
  docker run --rm --user "$(id -u):$(id -g)" --env HOME=/tmp \
    --env OPENRAPOO_OUTPUT_DIR=/out --env OPENRAPOO_BUILD_CACHE=/cache \
    --mount "type=bind,source=$root,target=/src,readonly" \
    --mount "type=bind,source=$out,target=/out" \
    --mount "type=bind,source=$cache,target=/cache" \
    openrapoo-appimage-builder bash /src/scripts/build-appimage.sh
  exit
fi
[[ $# -eq 0 && "$(uname -s)" == Linux ]] || { echo "On macOS use: $0 --docker" >&2; exit 2; }

case "$(uname -m)" in
  x86_64) tool_arch=x86_64; tool_sha=ed4ce84f0d9caff66f50bcca6ff6f35aae54ce8135408b3fa33abfc3cb384eb0; cc=gcc ;;
  aarch64) tool_arch=aarch64; tool_sha=f0837e7448a0c1e4e650a93bb3e85802546e60654ef287576f46c71c126a9158; cc=x86_64-linux-gnu-gcc ;;
  *) echo 'Build host must be x86-64 or ARM64 Linux.' >&2; exit 2 ;;
esac
for cmd in "$cc" curl unzip sha256sum node desktop-file-validate file; do
  command -v "$cmd" >/dev/null || { echo "Missing $cmd; use --docker or install the Linux build requirements." >&2; exit 2; }
done
cd "$root"
version="$(node -p 'require("./app/package.json").version')"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Invalid app version: $version" >&2; exit 2; }
name="OpenRapoo-$version-linux-x86_64"
work="$(mktemp -d "$cache/build.XXXXXXXX")"
trap 'rm -rf -- "$work"' EXIT
download() {
  local url="$1" sha="$2" dest="$3"
  if [[ ! -f "$dest" ]] || ! printf '%s  %s\n' "$sha" "$dest" | sha256sum --check --status; then
    curl --fail --silent --show-error --location --retry 3 --output "$work/download" "$url"
    printf '%s  %s\n' "$sha" "$work/download" | sha256sum --check
    mv -f -- "$work/download" "$dest"
  fi
}
electron=v45.3.0
download "https://github.com/electron/electron/releases/download/$electron/electron-$electron-linux-x64.zip" \
  4930ece46f988e5874df77e943d98a10655d3da9e268e66ed86c1250bdca089c "$cache/electron-$electron-linux-x64.zip"
download "https://github.com/AppImage/appimagetool/releases/download/1.9.1/appimagetool-$tool_arch.AppImage" \
  "$tool_sha" "$cache/appimagetool-1.9.1-$tool_arch.AppImage"
download "https://github.com/AppImage/type2-runtime/releases/download/20251108/runtime-x86_64" \
  2fca8b443c92510f1483a883f60061ad09b46b978b2631c807cd873a47ec260d "$cache/runtime-x86_64-20251108"
node --test app/test/*.test.mjs
appdir="$work/OpenRapoo.AppDir"
runtime="$appdir/usr/lib/openrapoo"
application="$runtime/resources/app"
mkdir -p "$application/app/native"
unzip -qo "$cache/electron-$electron-linux-x64.zip" -d "$runtime"
mv "$runtime/electron" "$runtime/openrapoo"
rm -f -- "$runtime/resources/default_app.asar"
cp -R app/public app/src app/data "$application/app/"
cp app/server.mjs app/package.json "$application/app/"
cp app/native/linux-hid.mjs "$application/app/native/"
cp packaging/linux/main.mjs packaging/linux/AppImage-runtime-LICENSE.txt LICENSE THIRD_PARTY_NOTICES.md "$application/"
cp packaging/assets/app-icon-1024.png "$application/app-icon.png"
printf '{"name":"openrapoo","productName":"OpenRapoo","version":"%s","type":"module","main":"main.mjs"}\n' "$version" > "$application/package.json"
"$cc" -std=gnu11 -Wall -Wextra -Werror -O2 packaging/linux/hidraw.c -o "$application/app/native/linux-hid"
file "$runtime/openrapoo" "$application/app/native/linux-hid" | awk '/x86-64/ { ++ok } END { exit ok != 2 }'
install -m 755 packaging/linux/AppRun "$appdir/AppRun"
install -m 644 packaging/linux/openrapoo.desktop "$appdir/openrapoo.desktop"
install -m 644 packaging/assets/app-icon-1024.png "$appdir/openrapoo.png"
install -m 644 packaging/linux/70-openrapoo.rules "$appdir/70-openrapoo.rules"
desktop-file-validate "$appdir/openrapoo.desktop"
cp "$cache/appimagetool-1.9.1-$tool_arch.AppImage" "$work/appimagetool"
chmod 755 "$work/appimagetool"
(
  cd "$work"
  ./appimagetool --appimage-extract >/dev/null
  ARCH=x86_64 ./squashfs-root/AppRun --no-appstream \
    --runtime-file "$cache/runtime-x86_64-20251108" "$appdir" "$work/$name.AppImage"
)
file "$work/$name.AppImage" | grep -q 'x86-64'
install -m 755 "$work/$name.AppImage" "$out/$name.AppImage"
(cd "$out" && sha256sum "$name.AppImage" > "$name.sha256")
printf '\nBuilt %s/%s.AppImage\n' "$out" "$name"

# OpenRapoo 1.2.1

- Add an x86-64 Linux AppImage with its own desktop window and native receiver access.
- Provide a repeatable Linux build script with an optional Docker path for x86-64 and ARM64 hosts.
- Bundle the receiver-specific udev rule in the AppImage and provide a one-time setup command. See the [Linux guide](https://github.com/diamachi/rapoo-mt760L/blob/main/docs/LINUX.md) for installation and testing.
- Retain the Windows receiver detection fix from 1.1.2. Built-in polling measurement remains macOS only.

**Linux:** open the executable AppImage as your desktop user. Run the AppImage with `--install-udev-rule` if receiver access is denied. **Mac:** drag OpenRapoo from the DMG into Applications. **Windows:** run the setup EXE or use the portable ZIP. The packages are unsigned.

Linux receiver detection, DPI, buttons, polling selection and battery need a physical device check before publication.

# OpenRapoo 1.1.2

- Fix Windows receiver detection when the vendor configuration report is represented as a HID array rather than a value capability.
- Validate report BA in memory using the Windows HID parser, while retaining receiver identity, vendor collection and report-size checks. Detection sends no configuration report.
- Improve failed-scan messages and exported per-interface diagnostics without exposing USB device paths.
- Add regression checks for array reports, incompatible collections and failed connection scans.
- Includes the bundled typography and responsive interface from v1.1.1.

**Mac:** open the DMG and drag OpenRapoo into Applications. **Windows:** run the setup EXE and open OpenRapoo from Start. The portable runtime is included; normal use needs no terminal. Windows setup adds WebView2 only if missing (internet required for that prerequisite).

The packages are unsigned. For macOS quarantine and Input Monitoring steps, see the repository README. The app never enables OS permissions automatically.

Validation: 33 source tests passed in the preceding test build, together with native app lifecycle checks and Windows install/uninstall checks. The updated build was tested successfully with the physical receiver passed through to a Windows VM. VM testing does not establish native Windows polling timing. Release automation repeats package checks and verifies download checksums before publication.

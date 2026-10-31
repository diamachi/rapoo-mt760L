# OpenRapoo 1.1.0

- Responsive type and spacing for larger displays, with **Settings → Interface size** overrides.
- Native title bars follow the app's light/dark theme. Windows adds per-monitor DPI awareness and display-fitting startup bounds.
- Receiver connection indicator in the header and a lightning symbol beside the mouse-reported battery percentage (not a charging-status indicator).
- Cohesive button map and editor with a shared Apply footer, improved callout spacing and a menu that fits larger text.
- macOS Input Monitoring onboarding: when permission is missing, a prompt offers **Open Input Monitoring** or **Not Now**. Receiver auto-connection waits for permission; enable the app in System Settings, then quit and reopen.
- README instructions for the unsigned Mac download, including `xattr -dr com.apple.quarantine /Applications/OpenRapoo.app`.
- Main-branch pushes automatically build and test both platforms. Release publication still requires an explicit release request or tag.

**Mac:** open the DMG and drag OpenRapoo into Applications. **Windows:** run the setup EXE and open OpenRapoo from Start. The portable runtime is included; normal use needs no terminal. Windows setup adds WebView2 only if missing (internet required for that prerequisite).

The packages are unsigned. For macOS quarantine and Input Monitoring steps, see the repository README. The app never enables OS permissions automatically.

Source tests, native window/service checks and Windows install/uninstall checks run before publication. These checks do not establish every physical mouse action. Windows battery behavior still needs a physical check; a transmitted setting is not firmware readback. Personal documentation and original vendor inputs are excluded.

# OpenRapoo 1.1.1

- Refined typography with DM Serif Display headings, italic lavender accents and DM Sans controls.
- Fonts are bundled locally for offline use; no font installation or external font requests.
- Updated README screenshots and documented CLI build/release commands.
- Includes all v1.1.0 improvements: responsive scaling, themed native title bars, receiver indicator, cohesive button editor and macOS Input Monitoring onboarding.

**Mac:** open the DMG and drag OpenRapoo into Applications. **Windows:** run the setup EXE and open OpenRapoo from Start. The portable runtime is included; normal use needs no terminal. Windows setup adds WebView2 only if missing (internet required for that prerequisite).

The packages are unsigned. For macOS quarantine and Input Monitoring steps, see the repository README. The app never enables OS permissions automatically.

Source tests, native window/service checks and Windows install/uninstall checks run before publication. These checks do not establish every physical mouse action. Windows battery behavior still needs a physical check; a transmitted setting is not firmware readback. Personal documentation and original vendor inputs are excluded.

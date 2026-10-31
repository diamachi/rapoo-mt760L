# OpenRapoo 0.4.0 preview

- Renamed the application, native windows, Dock/taskbar identity and packages to **OpenRapoo**.
- Cleaner visual button map with smaller numbers and separated wheel callouts.
- Wider, searchable action menu with grouped options and keyboard navigation.
- Left/right click assignments are locked until explicitly unlocked. The native API also checks per-request consent; resetting or applying relocks the editor.
- Updated screenshots, portable source-build instructions and file guide; smaller runtime file selection and lazy developer packet rendering.
- DPI stages, polling selector, mouse-reported battery and Nord-style dark mode remain available.

**Mac:** open the DMG and drag OpenRapoo into Applications. **Windows:** run the setup EXE and open OpenRapoo from Start. Normal use needs no terminal. The app bundles Node; Windows adds WebView2 only if missing (internet required for that prerequisite).

These packages are unsigned previews. Renaming the Mac app may require granting Input Monitoring to OpenRapoo and restarting it. The new app identity uses a separate window profile; previous UI preferences may need to be selected again. Remove the old installation when it is no longer needed.

Automated source/native-window/install checks do not establish every hardware action. Battery reporting and polling timing have been checked on Mac; Windows battery behavior still needs a physical check. A transmitted write is not firmware readback. Personal documentation and original vendor inputs are excluded.

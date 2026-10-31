import AppKit
import WebKit
import IOKit.hidsystem

// The application window owns its hidden local server. No Terminal or browser app.
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKDownloadDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!
    var server: Process?
    var timer: Timer?
    var closing = false
    var monitoringPromptShown = false
    var monitoringRequired = false
    var started = Date()
    let smoke = CommandLine.arguments.contains("--smoke-test")
    let workspace = Bundle.main.object(forInfoDictionaryKey: "RapooWorkspace") as? String
    var preview: Bool { workspace != nil }
    var port: Int { preview ? 8760 : 8765 }
    var home: URL { URL(string: "http://127.0.0.1:\(port)/")! }

    func applicationDidFinishLaunching(_ notification: Notification) {
        if let iconURL = Bundle.main.resourceURL?.appendingPathComponent("AppIcon.icns"),
           let icon = NSImage(contentsOf: iconURL) {
            NSApp.applicationIconImage = icon
        }
        let menu = NSMenu()
        let item = NSMenuItem()
        menu.addItem(item)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About OpenRapoo", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit OpenRapoo", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        item.submenu = appMenu
        let editItem = NSMenuItem(); menu.addItem(editItem)
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        edit.addItem(.separator())
        let reload = NSMenuItem(title: "Reload interface", action: #selector(reloadInterface), keyEquivalent: "r")
        reload.target = self
        edit.addItem(reload)
        editItem.submenu = edit
        NSApp.mainMenu = menu
        let visible = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1280, height: 900)
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: min(1200, visible.width - 32), height: min(820, visible.height - 60)), styleMask: [.titled,.closable,.miniaturizable,.resizable], backing: .buffered, defer: false)
        window.title = preview ? "OpenRapoo · Local Preview" : "OpenRapoo"
        window.minSize = NSSize(width: min(760, visible.width - 32), height: min(600, visible.height - 32))
        window.delegate = self
        window.titlebarAppearsTransparent = true
        window.center()
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.add(self, name: "appearance")
        config.userContentController.add(self, name: "inputMonitoring")
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.underPageBackgroundColor = .windowBackgroundColor
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        monitoringRequired = IOHIDCheckAccess(kIOHIDRequestTypeListenEvent) != kIOHIDAccessTypeGranted
        startServer()
    }

    // Keep the real macOS title bar and traffic-light controls; color it with the app.
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              let url = message.frameInfo.request.url, url.scheme == "http", url.host == "127.0.0.1", url.port == port,
              let body = message.body as? [String: Any] else { return }
        if message.name == "inputMonitoring", body["action"] as? String == "open-settings" {
            openInputMonitoringSettings()
            return
        }
        guard message.name == "appearance", body["type"] as? String == "appearance",
              let theme = body["theme"] as? String, theme == "dark" || theme == "light" else { return }
        let dark = theme == "dark"
        window.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
        let color = dark ? NSColor(srgbRed: 46/255.0, green: 52/255.0, blue: 64/255.0, alpha: 1)
                         : NSColor(srgbRed: 244/255.0, green: 245/255.0, blue: 239/255.0, alpha: 1)
        window.backgroundColor = color
        webView.underPageBackgroundColor = color
    }

    func openInputMonitoringSettings() {
        guard !smoke else { return }
        // This asks macOS to register/request access; only the user can approve it.
        _ = IOHIDRequestAccess(kIOHIDRequestTypeListenEvent)
        if let settings = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent") {
            NSWorkspace.shared.open(settings)
        }
    }

    func offerInputMonitoring() {
        guard !smoke, !monitoringPromptShown, monitoringRequired else { return }
        monitoringPromptShown = true
        let alert = NSAlert()
        let appName = Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String ?? "OpenRapoo"
        alert.messageText = "Allow Input Monitoring for \(appName)"
        alert.informativeText = "OpenRapoo needs Input Monitoring to connect to the MT760L receiver. Enable this app in System Settings → Privacy & Security → Input Monitoring, then quit and reopen it. No permission is enabled automatically."
        alert.addButton(withTitle: "Open Input Monitoring")
        alert.addButton(withTitle: "Not Now")
        alert.beginSheetModal(for: window) { [weak self] response in
            if response == .alertFirstButtonReturn { self?.openInputMonitoringSettings() }
        }
    }

    @objc func reloadInterface() { webView.reload() }

    func startServer() {
        guard let resources = workspace.map({ URL(fileURLWithPath: $0) }) ?? Bundle.main.resourceURL else { fail("Application resources are missing."); return }
        let process = Process()
        process.executableURL = resources.appendingPathComponent("_toolchain/portable-node-macos-arm64/node")
        process.arguments = [resources.appendingPathComponent("scripts/desktop-server.mjs").path]
        process.currentDirectoryURL = resources
        var env = ProcessInfo.processInfo.environment
        env["RAPOO_PORT"] = String(port)
        env["RAPOO_DEVELOPMENT"] = preview ? "1" : "0"
        env["RAPOO_INPUT_MONITORING_REQUIRED"] = monitoringRequired ? "1" : "0"
        env["RAPOO_PARENT_PID"] = String(ProcessInfo.processInfo.processIdentifier)
        process.environment = env
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        process.terminationHandler = { [weak self] _ in DispatchQueue.main.async { if let self = self, !self.closing { self.fail("The local app service stopped. Close other OpenRapoo instances, then reopen the app.") } } }
        server = process
        do { try process.run() } catch { fail("Could not start the bundled app service: \(error.localizedDescription)"); return }
        started = Date()
        timer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self] _ in self?.checkReady() }
    }

    func checkReady() {
        if Date().timeIntervalSince(started) > 15 { timer?.invalidate(); fail("The app service did not start. Another application may be using local port 8765."); return }
        guard server?.isRunning == true else { return }
        var request = URLRequest(url: home.appendingPathComponent("api/info"))
        request.timeoutInterval = 1
        URLSession.shared.dataTask(with: request) { [weak self] data, _, _ in
            guard let data = data, let info = try? JSONSerialization.jsonObject(with: data) as? [String: Any], info["app"] as? String == "openrapoo", (self?.preview == true || info["version"] as? String == Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String) else { return }
            DispatchQueue.main.async {
                guard let self = self, self.timer?.isValid == true, self.server?.isRunning == true else { return }
                self.timer?.invalidate()
                self.webView.load(URLRequest(url: self.home))
            }
        }.resume()
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if navigationAction.shouldPerformDownload && url.absoluteString.hasPrefix("blob:" + home.absoluteString) { decisionHandler(.download); return }
        decisionHandler(url.scheme == "http" && url.host == "127.0.0.1" && url.port == port ? .allow : .cancel)
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = suggestedFilename
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.url : nil) }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if smoke { checkInterface(attempt: 0) } else { offerInputMonitoring() }
    }

    func checkInterface(attempt: Int) {
        webView.evaluateJavaScript("({ready:document.querySelectorAll('.dpi-stage').length === 6 && document.querySelectorAll('.polling-rate').length === 4 && !document.getElementById('scroll'),theme:document.documentElement.dataset.theme})") { [weak self] result, _ in
            guard let self = self else { return }
            if let state = result as? [String: Any], state["ready"] as? Bool == true,
               let theme = state["theme"] as? String,
               self.window.appearance?.name == (theme == "dark" ? NSAppearance.Name.darkAqua : NSAppearance.Name.aqua) {
                print("{\"desktopSmokeTest\":\"passed\",\"terminalLaunched\":false,\"nativeThemeMatched\":true}")
                NSApp.terminate(nil)
            } else if attempt < 60 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { self.checkInterface(attempt: attempt + 1) }
            } else { self.fail("The desktop interface did not initialize.") }
        }
    }

    func fail(_ message: String) {
        guard !closing else { return }
        if smoke { fputs(message + "\n", stderr); cleanup(); exit(1) }
        let alert = NSAlert(); alert.messageText = "OpenRapoo"; alert.informativeText = message; alert.addButton(withTitle: "Quit"); alert.runModal()
        NSApp.terminate(nil)
    }
    func cleanup() { closing = true; webView?.configuration.userContentController.removeScriptMessageHandler(forName: "appearance"); webView?.configuration.userContentController.removeScriptMessageHandler(forName: "inputMonitoring"); timer?.invalidate(); if server?.isRunning == true { server?.terminate(); server?.waitUntilExit() } }
    func applicationWillTerminate(_ notification: Notification) { cleanup() }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { window?.makeKeyAndOrderFront(nil); return true }
}

if CommandLine.arguments.contains("--self-test") {
    let resources = (Bundle.main.object(forInfoDictionaryKey: "RapooWorkspace") as? String).map({ URL(fileURLWithPath: $0) }) ?? Bundle.main.resourceURL!
    let files = ["scripts/desktop-server.mjs", "app/server.mjs", "_toolchain/portable-node-macos-arm64/node"]
    guard files.allSatisfy({ FileManager.default.fileExists(atPath: resources.appendingPathComponent($0).path) }) else { exit(1) }
    print("OpenRapoo desktop launcher OK")
} else {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.setActivationPolicy(.regular)
    app.delegate = delegate
    app.run()
}

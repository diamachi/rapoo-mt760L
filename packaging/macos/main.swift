import AppKit
import WebKit

// The application window owns its hidden local server. No Terminal or browser app.
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKDownloadDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var server: Process?
    var timer: Timer?
    var closing = false
    var started = Date()
    let smoke = CommandLine.arguments.contains("--smoke-test")
    let home = URL(string: "http://127.0.0.1:8765/")!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu()
        let item = NSMenuItem()
        menu.addItem(item)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Rapoo Local", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Rapoo Local", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        item.submenu = appMenu
        let editItem = NSMenuItem(); menu.addItem(editItem)
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit
        NSApp.mainMenu = menu
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1200, height: 820), styleMask: [.titled,.closable,.miniaturizable,.resizable], backing: .buffered, defer: false)
        window.title = "Rapoo Local"
        window.minSize = NSSize(width: 760, height: 600)
        window.delegate = self
        window.center()
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.underPageBackgroundColor = .windowBackgroundColor
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        startServer()
    }

    func startServer() {
        guard let resources = Bundle.main.resourceURL else { fail("Application resources are missing."); return }
        let process = Process()
        process.executableURL = resources.appendingPathComponent("_toolchain/portable-node-macos-arm64/node")
        process.arguments = [resources.appendingPathComponent("scripts/desktop-server.mjs").path]
        process.currentDirectoryURL = resources
        var env = ProcessInfo.processInfo.environment
        env["RAPOO_PORT"] = "8765"
        env["RAPOO_PARENT_PID"] = String(ProcessInfo.processInfo.processIdentifier)
        process.environment = env
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        process.terminationHandler = { [weak self] _ in DispatchQueue.main.async { if let self = self, !self.closing { self.fail("The local app service stopped. Close other Rapoo Local instances, then reopen the app.") } } }
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
            guard let data = data, let info = try? JSONSerialization.jsonObject(with: data) as? [String: Any], info["app"] as? String == "rapoo-local", info["version"] as? String == Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String else { return }
            DispatchQueue.main.async {
                guard let self = self, self.timer?.isValid == true, self.server?.isRunning == true else { return }
                self.timer?.invalidate()
                self.webView.load(URLRequest(url: self.home))
            }
        }.resume()
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if navigationAction.shouldPerformDownload && url.absoluteString.hasPrefix("blob:http://127.0.0.1:8765/") { decisionHandler(.download); return }
        decisionHandler(url.scheme == "http" && url.host == "127.0.0.1" && url.port == 8765 ? .allow : .cancel)
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = suggestedFilename
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.url : nil) }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if smoke { checkInterface(attempt: 0) }
    }

    func checkInterface(attempt: Int) {
        webView.evaluateJavaScript("document.querySelectorAll('.dpi-stage').length === 6 && document.querySelectorAll('.polling-rate').length === 4 && !document.getElementById('scroll')") { [weak self] result, _ in
            guard let self = self else { return }
            if result as? Bool == true {
                print("{\"desktopSmokeTest\":\"passed\",\"terminalLaunched\":false}")
                NSApp.terminate(nil)
            } else if attempt < 60 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { self.checkInterface(attempt: attempt + 1) }
            } else { self.fail("The desktop interface did not initialize.") }
        }
    }

    func fail(_ message: String) {
        guard !closing else { return }
        if smoke { fputs(message + "\n", stderr); cleanup(); exit(1) }
        let alert = NSAlert(); alert.messageText = "Rapoo Local"; alert.informativeText = message; alert.addButton(withTitle: "Quit"); alert.runModal()
        NSApp.terminate(nil)
    }
    func cleanup() { closing = true; timer?.invalidate(); if server?.isRunning == true { server?.terminate(); server?.waitUntilExit() } }
    func applicationWillTerminate(_ notification: Notification) { cleanup() }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { window?.makeKeyAndOrderFront(nil); return true }
}

if CommandLine.arguments.contains("--self-test") {
    let resources = Bundle.main.resourceURL!
    let files = ["scripts/desktop-server.mjs", "app/server.mjs", "_toolchain/portable-node-macos-arm64/node"]
    guard files.allSatisfy({ FileManager.default.fileExists(atPath: resources.appendingPathComponent($0).path) }) else { exit(1) }
    print("Rapoo Local desktop launcher OK")
} else {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.setActivationPolicy(.regular)
    app.delegate = delegate
    app.run()
}

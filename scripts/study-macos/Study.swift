import AppKit
import WebKit

// 本地应用窗口持有 Web 服务；退出时结束自己启动的进程。
final class StudyApp: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var server: Process?
    var pipe: Pipe?
    var pending = ""
    var authenticatedURL: URL?
    var quitting = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        UserDefaults.standard.register(defaults: ["AppleLanguages": ["zh-Hans"]])
        let menu = NSMenu()
        let appMenu = NSMenu()
        let item = NSMenuItem(); item.submenu = appMenu; menu.addItem(item)
        appMenu.addItem(withTitle: "在浏览器中打开", action: #selector(openBrowser), keyEquivalent: "o")
        appMenu.addItem(withTitle: "重新加载书桌", action: #selector(reload), keyEquivalent: "r")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "退出深潜书桌", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let edit = NSMenuItem(title: "编辑", action: nil, keyEquivalent: "")
        let editMenu = NSMenu(title: "编辑")
        for (name, selector, key) in [("撤销", "undo:", "z"), ("剪切", "cut:", "x"), ("复制", "copy:", "c"), ("粘贴", "paste:", "v"), ("全选", "selectAll:", "a")] {
            editMenu.addItem(withTitle: name, action: Selector(selector), keyEquivalent: key)
        }
        edit.submenu = editMenu; menu.addItem(edit); NSApp.mainMenu = menu
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1400, height: 940), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "深潜书桌"
        window.appearance = NSAppearance(named: .darkAqua)
        window.minSize = NSSize(width: 760, height: 640)
        window.backgroundColor = NSColor(calibratedRed: 0.25, green: 0.17, blue: 0.11, alpha: 1)
        window.center()
        let configuration = WKWebViewConfiguration()
        // 使用 harness 已定义的原生语言桥；保存过的用户语言仍由 Host 决定。
        let locale = WKUserScript(source: "if (location.hostname === '127.0.0.1') { window.__DSH_LOCALE__ = { read: async () => ({ languages: ['zh-CN'], preference: null }), onChange: () => {} }; }", injectionTime: .atDocumentStart, forMainFrameOnly: true)
        configuration.userContentController.addUserScript(locale)
        web = WKWebView(frame: window.contentView!.bounds, configuration: configuration)
        web.appearance = NSAppearance(named: .aqua)
        web.autoresizingMask = [.width, .height]
        web.navigationDelegate = self; web.uiDelegate = self
        window.contentView = web
        window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
        web.loadHTMLString("<body style='background:#493422;color:#eadfc2;display:grid;place-content:center;height:100vh;margin:0;text-align:center;font-family:serif'><h1 style='font-weight:400;letter-spacing:.3em'>深潜书桌</h1><p>正在点亮台灯，铺开手稿…</p></body>", baseURL: nil)
        startServer()
    }

    func startServer() {
        let info = Bundle.main.infoDictionary!
        guard let project = info["StudyProjectDirectory"] as? String,
              let node = info["StudyNodeExecutable"] as? String else { showError("应用缺少启动路径，请重新构建。"); return }
        let process = Process(); let output = Pipe()
        process.executableURL = URL(fileURLWithPath: node)
        process.currentDirectoryURL = URL(fileURLWithPath: project)
        process.arguments = ["--import", "tsx/esm", "apps/cli/src/bin.ts", "web", "--no-open", "--host", "127.0.0.1", "--port", "0"]
        var environment = ProcessInfo.processInfo.environment
        environment["PATH"] = URL(fileURLWithPath: node).deletingLastPathComponent().path + ":/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        process.environment = environment
        process.standardOutput = output; process.standardError = output
        output.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { return }
            let text = String(decoding: data, as: UTF8.self)
            DispatchQueue.main.async { self?.receive(text) }
        }
        process.terminationHandler = { [weak self] process in
            DispatchQueue.main.async {
                guard let self, !self.quitting else { return }
                self.showError("本地服务已结束（\(process.terminationStatus)）。关闭并重新打开应用即可重试。")
            }
        }
        server = process; pipe = output
        do { try process.run() }
        catch { showError("无法启动本地服务：\(error.localizedDescription)") }
        DispatchQueue.main.asyncAfter(deadline: .now() + 60) { [weak self] in
            guard let self, self.authenticatedURL == nil, !self.quitting else { return }
            self.showError("服务启动超过一分钟。请确认源码目录和 Node.js 仍在构建时的位置，然后重新打开应用。")
        }
    }

    func receive(_ text: String) {
        guard authenticatedURL == nil else { return }
        pending += text
        guard pending.contains("\n") else { return }
        let pattern = #"http://127\.0\.0\.1:[0-9]+/\?token=[A-Za-z0-9_-]+"#
        guard let range = pending.range(of: pattern, options: .regularExpression), let url = URL(string: String(pending[range])) else {
            if pending.count > 32000 { pending = String(pending.suffix(16000)) }
            return
        }
        authenticatedURL = url; pending = ""
        web.load(URLRequest(url: url))
    }

    func showError(_ message: String) {
        let escaped = message.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;")
        web.loadHTMLString("<body style='background:#30261e;color:#e8dcc3;display:grid;place-content:center;height:100vh;margin:0;font-family:serif'><article style='max-width:36em;padding:3em;background:#eee3c9;color:#443c2c'><h1>书桌暂时未能打开</h1><p>\(escaped)</p></article></body>", baseURL: nil)
    }
    @objc func openBrowser() { if let url = authenticatedURL { NSWorkspace.shared.open(url) } }
    @objc func reload() { web.reload() }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) {
        quitting = true; pipe?.fileHandleForReading.readabilityHandler = nil
        if let server, server.isRunning { server.terminate() }
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        window.makeKeyAndOrderFront(nil); return true
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.shouldPerformDownload { decisionHandler(.download); return }
        if let url = navigationAction.request.url, navigationAction.navigationType == .linkActivated,
           url.host != authenticatedURL?.host, ["https", "http", "mailto"].contains(url.scheme ?? "") {
            NSWorkspace.shared.open(url); decisionHandler(.cancel); return
        }
        decisionHandler(.allow)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, ["https", "http"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        return nil
    }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel(); panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.urls : nil) }
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert(); alert.messageText = message; alert.addButton(withTitle: "确定"); alert.addButton(withTitle: "取消")
        alert.beginSheetModal(for: window) { completionHandler($0 == .alertFirstButtonReturn) }
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert(); alert.messageText = message; alert.addButton(withTitle: "确定")
        alert.beginSheetModal(for: window) { _ in completionHandler() }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
    }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = suggestedFilename
        panel.beginSheetModal(for: window) { completionHandler($0 == .OK ? panel.url : nil) }
    }
}
let app = NSApplication.shared
let delegate = StudyApp()
app.delegate = delegate
app.run()

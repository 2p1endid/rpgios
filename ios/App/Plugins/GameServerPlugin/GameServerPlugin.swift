import Capacitor
import GCDWebServer

@objc(GameServerPlugin)
public class GameServerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GameServerPlugin"
    public let jsName = "GameServer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startServer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopServer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isRunning", returnType: CAPPluginReturnPromise),
    ]

    private var webServer: GCDWebServer?
    private var serverPort: Int = 0

    @objc func startServer(_ call: CAPPluginCall) {
        guard let gamePath = call.getString("gamePath") else {
            call.reject("gamePath is required")
            return
        }

        // Stop existing server if running
        webServer?.stop()

        let server = GCDWebServer()

        // Serve static files from game directory
        server.addGETHandler(
            forBasePath: "/",
            directoryPath: gamePath,
            indexFilename: "index.html",
            cacheAge: 3600,
            allowRangeRequests: true
        )

        // Data directory with no caching (game state files)
        server.addGETHandler(
            forBasePath: "/data/",
            directoryPath: gamePath + "/data/",
            indexFilename: nil,
            cacheAge: 0,
            allowRangeRequests: true
        )

        do {
            try server.start(options: [
                GCDWebServerOption_Port: 0,  // auto-assign port
                GCDWebServerOption_BindToLocalhost: true,
                GCDWebServerOption_AutomaticallySuspendInBackground: true,
                GCDWebServerOption_ConnectedStateCoalescingInterval: 60.0,
            ])
            self.webServer = server
            self.serverPort = server.port
            call.resolve([
                "url": "http://127.0.0.1:\(server.port)/",
                "port": server.port,
            ])
        } catch {
            call.reject("Failed to start server: \(error.localizedDescription)")
        }
    }

    @objc func stopServer(_ call: CAPPluginCall) {
        webServer?.stop()
        webServer = nil
        serverPort = 0
        call.resolve()
    }

    @objc func isRunning(_ call: CAPPluginCall) {
        call.resolve([
            "running": webServer?.isRunning ?? false,
            "port": serverPort,
        ])
    }
}

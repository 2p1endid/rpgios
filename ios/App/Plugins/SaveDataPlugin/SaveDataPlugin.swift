import Capacitor

@objc(SaveDataPlugin)
public class SaveDataPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SaveDataPlugin"
    public let jsName = "SaveData"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "load", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listSlots", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteSave", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteAllForGame", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exportSaves", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "importSaves", returnType: CAPPluginReturnPromise),
    ]

    private var savesDirectory: URL {
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        return documents.appendingPathComponent("saves", isDirectory: true)
    }

    override public func load() {
        // Create saves directory if needed
        try? FileManager.default.createDirectory(
            at: savesDirectory,
            withIntermediateDirectories: true
        )
    }

    private func gameDirectory(_ gameId: String) -> URL {
        return savesDirectory.appendingPathComponent(gameId, isDirectory: true)
    }

    private func saveFile(_ gameId: String, _ slot: Int) -> URL {
        return gameDirectory(gameId).appendingPathComponent("slot_\(slot).rpgsave")
    }

    @objc func save(_ call: CAPPluginCall) {
        guard let gameId = call.getString("gameId"),
              let slot = call.getInt("slot"),
              let data = call.getString("data") else {
            call.reject("gameId, slot, and data are required")
            return
        }

        let dir = gameDirectory(gameId)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

        let fileUrl = saveFile(gameId, slot)
        do {
            try data.write(to: fileUrl, atomically: true, encoding: .utf8)
            call.resolve()
        } catch {
            call.reject("Failed to save: \(error.localizedDescription)")
        }
    }

    @objc func load(_ call: CAPPluginCall) {
        guard let gameId = call.getString("gameId"),
              let slot = call.getInt("slot") else {
            call.reject("gameId and slot are required")
            return
        }

        let fileUrl = saveFile(gameId, slot)
        guard FileManager.default.fileExists(atPath: fileUrl.path) else {
            call.resolve(["data": NSNull()])
            return
        }

        do {
            let data = try String(contentsOf: fileUrl, encoding: .utf8)
            call.resolve(["data": data])
        } catch {
            call.reject("Failed to load: \(error.localizedDescription)")
        }
    }

    @objc func listSlots(_ call: CAPPluginCall) {
        guard let gameId = call.getString("gameId") else {
            call.reject("gameId is required")
            return
        }

        let dir = gameDirectory(gameId)
        guard FileManager.default.fileExists(atPath: dir.path) else {
            call.resolve(["slots": []])
            return
        }

        do {
            let files = try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)
            let slots = files.compactMap { url -> Int? in
                let name = url.lastPathComponent
                guard name.hasPrefix("slot_"), name.hasSuffix(".rpgsave") else { return nil }
                let numStr = name.replacingOccurrences(of: "slot_", with: "")
                    .replacingOccurrences(of: ".rpgsave", with: "")
                return Int(numStr)
            }.sorted()
            call.resolve(["slots": slots])
        } catch {
            call.resolve(["slots": []])
        }
    }

    @objc func deleteSave(_ call: CAPPluginCall) {
        guard let gameId = call.getString("gameId"),
              let slot = call.getInt("slot") else {
            call.reject("gameId and slot are required")
            return
        }

        let fileUrl = saveFile(gameId, slot)
        try? FileManager.default.removeItem(at: fileUrl)
        call.resolve()
    }

    @objc func deleteAllForGame(_ call: CAPPluginCall) {
        guard let gameId = call.getString("gameId") else {
            call.reject("gameId is required")
            return
        }

        let dir = gameDirectory(gameId)
        try? FileManager.default.removeItem(at: dir)
        call.resolve()
    }

    @objc func exportSaves(_ call: CAPPluginCall) {
        guard let gameId = call.getString("gameId") else {
            call.reject("gameId is required")
            return
        }

        let dir = gameDirectory(gameId)
        guard FileManager.default.fileExists(atPath: dir.path) else {
            call.resolve(["data": "{}"])
            return
        }

        do {
            let files = try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)
            var export: [String: String] = [:]
            for file in files where file.pathExtension == "rpgsave" {
                let name = file.deletingPathExtension().lastPathComponent
                let content = try String(contentsOf: file, encoding: .utf8)
                export[name] = content
            }
            let jsonData = try JSONSerialization.data(withJSONObject: export, options: [])
            call.resolve(["data": String(data: jsonData, encoding: .utf8) ?? "{}"])
        } catch {
            call.reject("Export failed: \(error.localizedDescription)")
        }
    }

    @objc func importSaves(_ call: CAPPluginCall) {
        guard let gameId = call.getString("gameId"),
              let json = call.getString("data") else {
            call.reject("gameId and data are required")
            return
        }

        guard let jsonData = json.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: jsonData) as? [String: String] else {
            call.reject("Invalid save data format")
            return
        }

        var count = 0
        for (key, value) in dict {
            let fileName = key.hasSuffix(".rpgsave") ? key : "\(key).rpgsave"
            let dir = gameDirectory(gameId)
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let fileUrl = dir.appendingPathComponent(fileName)
            do {
                try value.write(to: fileUrl, atomically: true, encoding: .utf8)
                count += 1
            } catch {
                // Skip failed writes
            }
        }
        call.resolve(["count": count])
    }
}

import Capacitor

@objc(SaveDataPlugin)
public class SaveDataPlugin: CAPPlugin {
    private var savesDir: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
            .appendingPathComponent("saves", isDirectory: true)
    }

    override public func load() {
        try? FileManager.default.createDirectory(at: savesDir, withIntermediateDirectories: true)
    }

    private func fileUrl(_ gameId: String, _ slot: Int) -> URL {
        let dir = savesDir.appendingPathComponent(gameId, isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("slot_\(slot).rpgsave")
    }

    @objc func save(_ call: CAPPluginCall) {
        guard let gameId = call.getString("gameId"), let slot = call.getInt("slot"), let data = call.getString("data") else {
            return call.reject("gameId, slot, and data are required")
        }
        do { try data.write(to: fileUrl(gameId, slot), atomically: true, encoding: .utf8); call.resolve() }
        catch { call.reject("Save failed: \(error.localizedDescription)") }
    }

    @objc func load(_ call: CAPPluginCall) {
        guard let gameId = call.getString("gameId"), let slot = call.getInt("slot") else {
            return call.reject("gameId and slot are required")
        }
        let url = fileUrl(gameId, slot)
        guard FileManager.default.fileExists(atPath: url.path) else { return call.resolve(["data": NSNull()]) }
        do { call.resolve(["data": try String(contentsOf: url, encoding: .utf8)]) }
        catch { call.reject("Load failed: \(error.localizedDescription)") }
    }

    @objc func listSlots(_ call: CAPPluginCall) {
        guard let gameId = call.getString("gameId") else { return call.reject("gameId is required") }
        let dir = savesDir.appendingPathComponent(gameId, isDirectory: true)
        guard FileManager.default.fileExists(atPath: dir.path) else { return call.resolve(["slots": []]) }
        do {
            let slots = try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)
                .compactMap { url -> Int? in
                    let n = url.lastPathComponent
                    guard n.hasPrefix("slot_"), n.hasSuffix(".rpgsave") else { return nil }
                    return Int(n.replacingOccurrences(of: "slot_", with: "").replacingOccurrences(of: ".rpgsave", with: ""))
                }.sorted()
            call.resolve(["slots": slots])
        } catch { call.resolve(["slots": []]) }
    }

    @objc func deleteSave(_ call: CAPPluginCall) {
        guard let gameId = call.getString("gameId"), let slot = call.getInt("slot") else {
            return call.reject("gameId and slot are required")
        }
        try? FileManager.default.removeItem(at: fileUrl(gameId, slot))
        call.resolve()
    }

    @objc func deleteAllForGame(_ call: CAPPluginCall) {
        guard let gameId = call.getString("gameId") else { return call.reject("gameId is required") }
        try? FileManager.default.removeItem(at: savesDir.appendingPathComponent(gameId, isDirectory: true))
        call.resolve()
    }
}

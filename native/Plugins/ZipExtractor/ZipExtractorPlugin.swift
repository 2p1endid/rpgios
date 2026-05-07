import Capacitor
import SSZipArchive

@objc(ZipExtractorPlugin)
public class ZipExtractorPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ZipExtractorPlugin"
    public let jsName = "ZipExtractor"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "extract", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getExtractedPath", returnType: CAPPluginReturnPromise),
    ]

    @objc func extract(_ call: CAPPluginCall) {
        guard let zipPath = call.getString("zipPath"),
              let destDir = call.getString("destDir") else {
            call.reject("zipPath and destDir are required")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            let fileManager = FileManager.default

            // Ensure destination directory exists
            try? fileManager.createDirectory(
                atPath: destDir,
                withIntermediateDirectories: true
            )

            var success = false
            var errorMessage: String?

            do {
                try SSZipArchive.unzipFile(
                    atPath: zipPath,
                    toDestination: destDir,
                    progressHandler: { (entry, zipInfo, entryNumber, total) in
                        // Report progress back to JS side
                        let pct = total > 0 ? Int(Double(entryNumber) / Double(total) * 100) : 0
                        DispatchQueue.main.async {
                            self.notifyListeners("progress", data: [
                                "pct": pct,
                                "current": entry,
                                "entryNumber": entryNumber,
                                "total": total,
                            ])
                        }
                    }
                )
                success = true
            } catch {
                errorMessage = error.localizedDescription
            }

            DispatchQueue.main.async {
                if success {
                    call.resolve(["destDir": destDir])
                } else {
                    call.reject(errorMessage ?? "Extraction failed")
                }
            }
        }
    }

    @objc func getExtractedPath(_ call: CAPPluginCall) {
        guard let gameId = call.getString("gameId") else {
            call.reject("gameId is required")
            return
        }

        let documents = FileManager.default.urls(
            for: .documentDirectory, in: .userDomainMask
        ).first!
        let destDir = documents
            .appendingPathComponent("games", isDirectory: true)
            .appendingPathComponent(gameId, isDirectory: true)

        call.resolve([
            "path": destDir.path,
            "exists": FileManager.default.fileExists(atPath: destDir.path),
        ])
    }
}

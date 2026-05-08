import Capacitor
import SSZipArchive

@objc(ZipExtractorPlugin)
public class ZipExtractorPlugin: CAPPlugin {

    @objc func extract(_ call: CAPPluginCall) {
        guard let zipPath = call.getString("zipPath"),
              let destDir = call.getString("destDir") else {
            call.reject("zipPath and destDir are required")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            let fm = FileManager.default
            try? fm.createDirectory(atPath: destDir, withIntermediateDirectories: true)

            let ok = SSZipArchive.unzipFile(
                atPath: zipPath,
                toDestination: destDir,
                progressHandler: { (entry, zipInfo, entryNumber, total) in
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

            DispatchQueue.main.async {
                if ok {
                    call.resolve(["destDir": destDir])
                } else {
                    call.reject("Extraction failed")
                }
            }
        }
    }

    @objc func getExtractedPath(_ call: CAPPluginCall) {
        guard let gameId = call.getString("gameId") else {
            call.reject("gameId is required")
            return
        }
        let destDir = FileManager.default.urls(
            for: .documentDirectory, in: .userDomainMask
        ).first!
        .appendingPathComponent("games", isDirectory: true)
        .appendingPathComponent(gameId, isDirectory: true)

        call.resolve([
            "path": destDir.path,
            "exists": FileManager.default.fileExists(atPath: destDir.path),
        ])
    }
}

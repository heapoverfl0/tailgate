import Foundation
import CoreImage
import AppKit
let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let output = root.appendingPathComponent("apps/web/public/qr")
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
let files = try FileManager.default.contentsOfDirectory(at: root.appendingPathComponent("contests"), includingPropertiesForKeys: nil).filter { $0.pathExtension == "json" }
var manifest: [String: String] = [:]
for file in files {
 let payload = try JSONSerialization.jsonObject(with: Data(contentsOf: file)) as! [String: Any]
 let contest = payload["contest"] as! [String: Any]
 let id = contest["id"] as! String
 precondition(id.range(of: "^[a-zA-Z0-9_-]+$", options: .regularExpression) != nil)
 let url = "https://djhbbw57tyj22.cloudfront.net/?contest=\(id)"
 let filter = CIFilter(name: "CIQRCodeGenerator")!
 filter.setValue(Data(url.utf8), forKey: "inputMessage")
 filter.setValue("M", forKey: "inputCorrectionLevel")
 let qr = filter.outputImage!
 let context = CIContext()
 let quiet = qr.extent.insetBy(dx: -4, dy: -4)
 let background = CIImage(color: CIColor.white).cropped(to: quiet)
 let image = qr.composited(over: background).transformed(by: CGAffineTransform(scaleX: 10, y: 10))
 let cg = context.createCGImage(image, from: image.extent)!
 let bitmap = NSBitmapImageRep(cgImage: cg)
 let png = bitmap.representation(using: .png, properties: [:])!
 try png.write(to: output.appendingPathComponent("\(id).png"))
 let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: context, options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])!
 let decoded = detector.features(in: CIImage(data: png)!).compactMap { ($0 as? CIQRCodeFeature)?.messageString }
 precondition(decoded == [url], "QR decode verification failed")
 manifest[id] = url
 print("Generated and decoded: \(url)")
}
try JSONSerialization.data(withJSONObject: manifest, options: [.prettyPrinted, .sortedKeys]).write(to: root.appendingPathComponent("apps/web/src/contest-qr.json"))

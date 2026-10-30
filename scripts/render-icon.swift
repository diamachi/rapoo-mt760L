// Render the repository's SVG with macOS AppKit; no third-party image tools.
import AppKit
import Foundation
guard CommandLine.arguments.count == 3,
      let image = NSImage(contentsOfFile: CommandLine.arguments[1]),
      let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 1024, pixelsHigh: 1024, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0),
      let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
    fputs("Unable to render SVG app icon\n", stderr); exit(1)
}
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
image.draw(in: NSRect(x: 0,y: 0,width: 1024,height: 1024))
NSGraphicsContext.restoreGraphicsState()
guard let png = bitmap.representation(using: .png, properties: [:]) else {exit(1)}
try png.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))

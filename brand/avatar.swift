import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let size = 512.0
let space = CGColorSpaceCreateDeviceRGB()
let ctx = CGContext(data: nil, width: Int(size), height: Int(size), bitsPerComponent: 8,
                    bytesPerRow: 0, space: space,
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!

// Deep blue ground: reads as a solid colour in a chat list, not as mush.
let gradient = CGGradient(colorsSpace: space, colors: [
    CGColor(red: 0.16, green: 0.33, blue: 0.76, alpha: 1),
    CGColor(red: 0.09, green: 0.18, blue: 0.47, alpha: 1),
] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(gradient, start: CGPoint(x: 0, y: size),
                       end: CGPoint(x: size, y: 0), options: [])

// Squared-paper grid, the notebook the notes come from.
ctx.setStrokeColor(CGColor(red: 1, green: 1, blue: 1, alpha: 0.10))
ctx.setLineWidth(2)
for step in stride(from: 0.0, through: size, by: size / 8) {
    ctx.move(to: CGPoint(x: step, y: 0)); ctx.addLine(to: CGPoint(x: step, y: size))
    ctx.move(to: CGPoint(x: 0, y: step)); ctx.addLine(to: CGPoint(x: size, y: step))
}
ctx.strokePath()

// A bone, drawn as two knobs and a shaft, tilted so it fills the circle Telegram crops to.
ctx.saveGState()
ctx.translateBy(x: size / 2, y: size / 2)
ctx.rotate(by: .pi / 4)
ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))

// Sized to sit inside the circle Telegram crops avatars to, with margin.
let shaftLength = 132.0, shaftHalf = 30.0, knob = 41.0, knobGap = 29.0
ctx.fill(CGRect(x: -shaftLength, y: -shaftHalf, width: shaftLength * 2, height: shaftHalf * 2))
for side in [-1.0, 1.0] {
    for offset in [-knobGap, knobGap] {
        ctx.fillEllipse(in: CGRect(x: side * shaftLength - knob, y: offset - knob,
                                   width: knob * 2, height: knob * 2))
    }
}
ctx.restoreGState()

let image = ctx.makeImage()!
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let destination = CGImageDestinationCreateWithURL(url as CFURL,
                                                  UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(destination, image, nil)
CGImageDestinationFinalize(destination)
print("wrote \(url.lastPathComponent)")

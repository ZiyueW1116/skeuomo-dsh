import AppKit
// 图标使用与书桌一致的皮革、纸边和黄铜配色。
let canvas = NSImage(size: NSSize(width: 1024, height: 1024))
canvas.lockFocus()
let shadow = NSShadow(); shadow.shadowColor = NSColor.black.withAlphaComponent(0.5); shadow.shadowBlurRadius = 35; shadow.shadowOffset = NSSize(width: 0, height: -15)
shadow.set()
let book = NSBezierPath(roundedRect: NSRect(x: 150, y: 90, width: 730, height: 850), xRadius: 60, yRadius: 60)
NSColor(calibratedRed: 0.13, green: 0.28, blue: 0.22, alpha: 1).setFill(); book.fill()
NSShadow().set()
let pages = NSBezierPath(roundedRect: NSRect(x: 192, y: 105, width: 650, height: 85), xRadius: 20, yRadius: 20)
NSColor(calibratedRed: 0.86, green: 0.81, blue: 0.68, alpha: 1).setFill(); pages.fill()
for y in stride(from: 117, through: 177, by: 8) {
    let line = NSBezierPath(); line.move(to: NSPoint(x: 213, y: y)); line.line(to: NSPoint(x: 827, y: y)); line.lineWidth = 1
    NSColor(calibratedWhite: 0.3, alpha: 0.25).setStroke(); line.stroke()
}
let cover = NSBezierPath(roundedRect: NSRect(x: 150, y: 170, width: 730, height: 770), xRadius: 50, yRadius: 50)
NSGradient(starting: NSColor(calibratedRed: 0.27, green: 0.43, blue: 0.34, alpha: 1), ending: NSColor(calibratedRed: 0.10, green: 0.23, blue: 0.18, alpha: 1))!.draw(in: cover, angle: -30)
let spine = NSBezierPath(rect: NSRect(x: 185, y: 190, width: 30, height: 725))
NSColor.black.withAlphaComponent(0.20).setFill(); spine.fill()
let border = NSBezierPath(roundedRect: NSRect(x: 255, y: 265, width: 545, height: 585), xRadius: 8, yRadius: 8)
let gold = NSColor(calibratedRed: 0.80, green: 0.67, blue: 0.39, alpha: 1)
gold.setStroke(); border.lineWidth = 3; border.stroke()
let attributes: [NSAttributedString.Key: Any] = [.font: NSFont(name: "Songti SC", size: 150) ?? NSFont.systemFont(ofSize: 150), .foregroundColor: gold]
("深潜" as NSString).draw(at: NSPoint(x: 375, y: 570), withAttributes: attributes)
("书桌" as NSString).draw(at: NSPoint(x: 375, y: 385), withAttributes: attributes)
let rule = NSBezierPath(); rule.move(to: NSPoint(x: 355, y: 340)); rule.line(to: NSPoint(x: 700, y: 340)); rule.lineWidth = 2; rule.stroke()
canvas.unlockFocus()
let bitmap = NSBitmapImageRep(data: canvas.tiffRepresentation!)!
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))

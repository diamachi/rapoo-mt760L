// Read-only, six-second measurement of this receiver's mouse interface.
// No keyboard interface, output reports, event tap, or exclusive access.
import Foundation
import IOKit.hid
import Darwin

final class Capture {
    var timestamps: [UInt64] = []
    var reports = 0
}
func output(_ value: [String: Any], code: Int32 = 0) -> Never {
    let data = try! JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    print(String(data: data, encoding: .utf8)!)
    exit(code)
}
if CommandLine.arguments.contains("--self-test") {
    output(["measurementSelfTest": "passed", "reportsSent": 0])
}
let manager = IOHIDManagerCreate(kCFAllocatorDefault, IOOptionBits(kIOHIDOptionsTypeNone))
IOHIDManagerSetDeviceMatching(manager, [kIOHIDVendorIDKey: 0x24ae, kIOHIDProductIDKey: 0x1870,
    kIOHIDDeviceUsagePageKey: 1, kIOHIDDeviceUsageKey: 2] as CFDictionary)
guard let devices = IOHIDManagerCopyDevices(manager) as? Set<IOHIDDevice>, devices.count == 1,
      let device = devices.first else {
    output(["error": "Connect the MT760L 2.4 GHz receiver. Exactly one matching mouse interface is required."], code: 1)
}
// Layout from the supplied receiver: buttons, signed 16-bit X/Y, two wheels.
let expected = "05010902a1010901a1000509190129051500250175019505810275039501810105010930093116008026ff7f75109502810609381581257f750895018106050c0a380295018106c0c0"
guard let descriptor = IOHIDDeviceGetProperty(device, kIOHIDReportDescriptorKey as CFString) as? Data,
      descriptor.map({ String(format: "%02x", $0) }).joined() == expected else {
    output(["error": "Mouse report layout differs from the known receiver. Measurement was not started."], code: 1)
}
let result = IOHIDDeviceOpen(device, IOOptionBits(kIOHIDOptionsTypeNone))
guard result == kIOReturnSuccess else {
    output(["error": String(format: "macOS denied mouse-report measurement (0x%08x). Input Monitoring permission may be required for the preview app. No permission was changed.", UInt32(bitPattern: result))], code: 1)
}
if CommandLine.arguments.contains("--probe") {
    IOHIDDeviceClose(device, 0)
    output(["mouseInterface": "MT760L 24ae:1870", "measurementAvailable": true, "reportsSent": 0])
}
let capture = Capture()
let context = Unmanaged.passUnretained(capture).toOpaque()
let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: 64)
buffer.initialize(repeating: 0, count: 64)
IOHIDDeviceRegisterInputReportWithTimeStampCallback(device, buffer, 64, { context, status, _, _, reportID, bytes, count, timestamp in
    guard status == kIOReturnSuccess, reportID == 0, count == 7, let context = context else { return }
    let capture = Unmanaged<Capture>.fromOpaque(context).takeUnretainedValue()
    capture.reports += 1
    // Retain timestamps only, never movement coordinates or button states.
    if bytes[1] != 0 || bytes[2] != 0 || bytes[3] != 0 || bytes[4] != 0 {
        if capture.timestamps.count < 50000 { capture.timestamps.append(timestamp) }
    }
}, context)
IOHIDDeviceScheduleWithRunLoop(device, CFRunLoopGetCurrent(), CFRunLoopMode.defaultMode.rawValue)
let start = Date()
while Date().timeIntervalSince(start) < 6 {
    CFRunLoopRunInMode(CFRunLoopMode.defaultMode, 0.1, false)
}
IOHIDDeviceUnscheduleFromRunLoop(device, CFRunLoopGetCurrent(), CFRunLoopMode.defaultMode.rawValue)
IOHIDDeviceRegisterInputReportWithTimeStampCallback(device, buffer, 64, nil, nil)
IOHIDDeviceClose(device, 0)
buffer.deallocate()
var timebase = mach_timebase_info_data_t()
mach_timebase_info(&timebase)
let msPerTick = Double(timebase.numer) / Double(timebase.denom) / 1_000_000
let times = capture.timestamps
let intervals = zip(times.dropFirst(), times).compactMap { newer, older -> Double? in
    newer > older ? Double(newer - older) * msPerTick : nil
}
output(["intervalsMs": intervals, "reports": capture.reports, "movementReports": times.count,
    "durationSeconds": Date().timeIntervalSince(start), "source": "macOS HID report timestamps", "reportsSent": 0])

# MT760L battery reporting

## Protocol evidence

The BaseDevice `getElectricity` export is at VA `6fd87060`. Its virtual slot is `0x120` in the base vtable at `6ffca338`. The MT760 vtable at `6ffcd030` overrides that slot with `6fdee290`. Both call the transport slot `0x190` and accept a result only when the decoded first byte is `01`. The following two bytes are passed to the application as `BatStatus` and `Electricity` (percentage); the vendor caps the latter at 100.

Transport vtable `6ffcc110` maps slot `0x190` to `6fd2f8a0`, which looks up command-map key `0x7da`. The BA/A5 command family builds that entry at `6fd30dae..6fd30e49` as three bytes: report ID, command marker, `aa`. This produces the fixed 32-byte output report `ba a5 aa` followed by 29 zero bytes. This is a status query; it does not use the parameter-write opcode or an address.

The `ba b0` request at capture frame 32 belongs to a different command-map entry (`0x3f3`); it is not used as the battery query. Other device-family variants of `0x7da` are not exposed.

## Live result — 2026-10-31

The attached 2.4 GHz receiver (`24ae:1870`) returned three bytes from `IOHIDDeviceGetReport`, Input type, report ID BA, after the fixed battery query:

```
01 01 4c
```

That is success `01`, raw `BatStatus` `01`, and `0x4c` = **76 percent**. The app displays that number directly. The meaning of each charging-state value has not been verified, so it does not label this code as charging or discharging.

The parser accepts the live three-byte layout or the same three bytes with zero padding to 32 bytes. It rejects failed status, values over 100, unexpected lengths and nonzero trailing bytes. No fallback to a guessed percentage, voltage curve or cached value from a previous session is used. A failed refresh displays “Battery unavailable”; error details remain in Developer tools. Sleeping-mouse reads can return a short pending reply or a USB control-read stall. The helper bounds retries to three complete query/read transactions, then asks the user to wake the mouse and refresh. The owner confirmed that waking and refreshing restored the percentage; the preview visibly displayed 76%.

The API requires the existing same-origin session token and a connected receiver ID. It briefly caches successful readings for 15 seconds, excludes measurement/write overlap, reads on connection, and refreshes every minute while the window is visible. The refresh button uses the same API. Raw BatStatus is retained by the API without assigning an unverified charging meaning.

macOS uses the existing shared HID handle and no input callbacks. Windows source uses the same fixed query with `HidD_GetInputReport`; that Windows path has not yet been physically tested. Browser-only WebHID does not expose this GET_REPORT(Input) operation, so the battery read is currently a native-app capability.

Reproduce static evidence with `scripts/inspect-disassembly.mjs`; original DLL/disassembly remain local. No vendor executable was run and no firmware/configuration write was used to obtain this reading.

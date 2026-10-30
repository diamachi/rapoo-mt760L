# MT760 polling rate evidence

The 0.2.0 selector offers 125, 250, 500 and 1000 Hz over the receiver. No polling change is sent on app startup. The selected rate is an app-side indication, not readback or a measured rate. On 2026-10-31 the owner reported that the new native Mac measurement shows the correct values after enabling access. A subsequent visible preview result showed 250 Hz requested, median 4.00 ms (250 Hz), active mean 250 Hz, middle 80% 3.98–4.02 ms across 1508 intervals with no excluded intervals. Firmware readback remains unavailable.

## Mapping and write layout

Base constructor DLL VA `6fd90632` initializes object bytes `0xf8..0xfb` as `08 04 02 01`. MT760 constructor `6feafda7` puts address `0x630` in field `0x358`. Setter at `6feb7ea0` takes a rate index; the list built at `6feb7f95..6feb7fef` begins 125, 250, 500, 1000 (other family rates in that generic list are not offered).

Successful read branch `6feb8140..6feb81c2` preserves a two-byte tail, gets the indexed code from object `0xf8`, writes the same code to parameter offsets zero and one, restores the tail, sets length 4 and uses the `0x630` address field.

| Hz | Code | Parameter bytes |
| --- | --- | --- |
| 125 | 08 | 08 08 ff ff |
| 250 | 04 | 04 04 ff ff |
| 500 | 02 | 02 02 ff ff |
| 1000 | 01 | 01 01 ff ff |

Frames 40/44/48/52/56 contain the 1000/250/125/1000/125 encodings respectively. The golden tests compare complete reports. 500 Hz follows the same constructor/setter map. The shared encoder preserves the captured ff ff tail and rejects unsupported rates, mismatched codes or changed padding. The Mac/Windows backend validates these polling writes.

Full output report: `ba a5 a5 04 30 06 00 00 [four parameter bytes] [20 zero bytes]`.

The vendor reads the current block before changing it. This app has no live readback, so it uses the supplied capture's tail. That limitation is unchanged from other template-based configuration. No speculative 2/4/8 kHz options are exposed.

Research reproduction, using the original supplied DLL and generated disassembly:

```sh
_toolchain/portable-node-macos-arm64/node scripts/inspect-disassembly.mjs 6fd90620 6fd90665
_toolchain/portable-node-macos-arm64/node scripts/inspect-disassembly.mjs 6feb8140 6feb81c8
```

## Local diagnostic added after the 0.2.0 preview

A flat 120 Hz website result was reported by the owner. Browser input coalescing can hide higher device rates, so this result alone does not validate or disprove the command. No speculative change was made to the capture/DLL-based encoder. The local Mac preview now includes a bounded native report-timestamp measurement; see docs/LOCAL-TESTING.md. The owner subsequently reported correct native measurements on this Mac after enabling access. Transmission and measured behavior remain separate; this is not firmware readback or Windows validation.

The 250 Hz result above was visible in the local preview during the owner’s test. A subsequent screenshot shows 500 Hz requested, median 2.00 ms (500 Hz), active mean 499 Hz, middle 80% 1.99–2.01 ms across 3034 intervals with no excluded intervals. That screenshot is saved locally as `docs/local-preview-nord-polling.png`. No new GitHub release or upload was made.

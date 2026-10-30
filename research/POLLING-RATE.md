# MT760 polling rate evidence

The 0.2.0 selector offers 125, 250, 500 and 1000 Hz over the receiver. No polling change is sent on app startup. The selected rate is an app-side indication, not readback or a measured rate. Physical behavior of the new selector still needs testing.

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

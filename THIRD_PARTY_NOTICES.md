# Third-party notices

Rapoo Local source and the original SVG schematic are covered by the root MIT license. Rapoo and MT760L names identify compatible hardware; their trademarks belong to their owners. This project is unofficial.

## Node.js

Binary application packages include portable Node.js. Each package keeps the corresponding complete upstream `LICENSE` beside its executable under `_toolchain/`. This includes Node's license and notices for bundled components. No npm package tree is redistributed. See https://nodejs.org/ and https://github.com/nodejs/node/blob/main/LICENSE .

The Mac runtime was copied from the user's existing Node v26.4.0 installation. The local Windows runtime was already supplied in this workspace; it has not been executed here. GitHub builders download Node v26.4.0 from nodejs.org and verify the archive against that distribution's SHA-256 list. These licenses cover their respective binaries, separately from the app's MIT license.

## Research material excluded from distribution

The original Rapoo Windows software, DLLs, original PCAPNG, reverse-engineering toolchain, generated disassembly and cached manufacturer photograph are not included in source/app ZIPs. Their owners retain their rights. Research scripts refer to those local inputs if you supply them separately; they are not app dependencies.

The bundled stripped protocol fixture contains only device configuration transfer information used to reproduce and test the implementation. It contains no original capture container, timestamps, IRP pointers or USB host/bus identifiers.

// Creates a local app window that serves the working source, without installing it.
import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
if(process.platform!=='darwin' || process.arch!=='arm64')throw Error('This local preview builder requires this Apple silicon Mac');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=path.join(root,'preview/Rapoo Local Preview.app');
const cache=path.join(root,'_toolchain/build-cache');
await mkdir(path.join(app,'Contents/MacOS'),{recursive:true});
await mkdir(path.join(app,'Contents/Resources'),{recursive:true});
await cp(path.join(root,'packaging/assets/AppIcon.icns'),path.join(app,'Contents/Resources/AppIcon.icns'));
await mkdir(path.join(cache,'swift'),{recursive:true});
let plist=await readFile(path.join(root,'packaging/macos/Info.plist'),'utf8');
plist=plist.replaceAll('<string>Rapoo Local</string>','<string>Rapoo Local Preview</string>');
plist=plist.replace(/<key>CFBundleIdentifier<\/key>\s*<string>[^<]*<\/string>/,'<key>CFBundleIdentifier</key><string>local.rapoo.preview</string>');
plist=plist.replace('</dict>',`<key>RapooWorkspace</key><string>${root.replaceAll('&','&amp;').replaceAll('<','&lt;')}</string></dict>`);
await writeFile(path.join(app,'Contents/Info.plist'),plist);
function compile(source,dest,frameworks){execFileSync('/usr/bin/xcrun',['swiftc','-swift-version','5','-target','arm64-apple-macosx14.0','-module-cache-path',path.join(cache,'swift'),'-O',...frameworks.flatMap(x=>['-framework',x]),path.join(root,source),'-o',dest],{stdio:'inherit'});}
compile('app/native/macos-rate.swift',path.join(cache,'macos-rate'),['IOKit']);
compile('packaging/macos/main.swift',path.join(app,'Contents/MacOS/RapooLocal'),['AppKit','WebKit']);
execFileSync(path.join(app,'Contents/MacOS/RapooLocal'),['--self-test'],{stdio:'inherit'});
execFileSync(path.join(cache,'macos-rate'),['--self-test'],{stdio:'inherit'});
console.log(`Open ${app}\nUI edits: Command+R. Backend edits: quit and reopen. Nothing is installed or published.`);

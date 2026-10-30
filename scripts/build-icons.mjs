// Reproducible local icon assets, using existing macOS AppKit/sips/iconutil only.
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
if(process.platform!=='darwin')throw Error('Generate icon assets on macOS; Windows builds use the checked-in ICO');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cache=path.join(root,'_toolchain/build-cache');
const assets=path.join(root,'packaging/assets');
await mkdir(path.join(cache,'swift'),{recursive:true});await mkdir(assets,{recursive:true});
const renderer=path.join(cache,'render-icon'),png=path.join(assets,'app-icon-1024.png');
execFileSync('/usr/bin/xcrun',['swiftc','-module-cache-path',path.join(cache,'swift'),'-O','-framework','AppKit',path.join(root,'scripts/render-icon.swift'),'-o',renderer],{stdio:'inherit'});
execFileSync(renderer,[path.join(root,'app/public/assets/app-icon.svg'),png],{stdio:'inherit'});
const iconset=path.join(cache,'Rapoo.iconset');await rm(iconset,{recursive:true,force:true});await mkdir(iconset);
const resize=(size,file)=>execFileSync('/usr/bin/sips',['-z',String(size),String(size),png,'--out',file],{stdio:'ignore'});
for(const size of [16,32,128,256,512])for(const scale of [1,2])resize(size*scale,path.join(iconset,`icon_${size}x${size}${scale===2?'@2x':''}.png`));
execFileSync('/usr/bin/iconutil',['-c','icns',iconset,'-o',path.join(assets,'AppIcon.icns')],{stdio:'inherit'});
const sizes=[16,24,32,48,64,128,256],images=[];
for(const size of sizes){const file=path.join(cache,`icon-${size}.png`);resize(size,file);images.push(await readFile(file));await rm(file);}
const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
let offset=header.length;
sizes.forEach((size,i)=>{const o=6+16*i;header[o]=header[o+1]=size===256?0:size;header.writeUInt16LE(1,o+4);header.writeUInt16LE(32,o+6);header.writeUInt32LE(images[i].length,o+8);header.writeUInt32LE(offset,o+12);offset+=images[i].length;});
await writeFile(path.join(assets,'app-icon.ico'),Buffer.concat([header,...images]));
await rm(iconset,{recursive:true});
console.log('Generated Mac ICNS, Windows ICO and PNG from app/public/assets/app-icon.svg');

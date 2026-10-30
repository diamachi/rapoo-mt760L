// Used on GitHub-hosted builders only. No global installation or package manager.
import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const target=process.argv[2],version='26.4.0';
if(!['macos-arm64','windows-x64'].includes(target))throw Error('Expected macos-arm64 or windows-x64');
const mac=target==='macos-arm64',base=`node-v${version}-${mac?'darwin-arm64':'win-x64'}`,archive=base+(mac?'.tar.gz':'.zip');
const origin=`https://nodejs.org/dist/v${version}/`;
async function get(name){const r=await fetch(origin+name);if(!r.ok)throw Error(`Download failed: ${r.status} ${name}`);return Buffer.from(await r.arrayBuffer());}
const sums=(await get('SHASUMS256.txt')).toString(),expected=sums.split('\n').map(x=>x.trim().split(/\s+/)).find(x=>x[1]===archive)?.[0];
const data=await get(archive);if(!expected||createHash('sha256').update(data).digest('hex')!==expected)throw Error('Node archive SHA-256 mismatch');
await mkdir('dist/runtime-download',{recursive:true});await writeFile(`dist/runtime-download/${archive}`,data);
if(mac)execFileSync('tar',['-xzf',`dist/runtime-download/${archive}`,'-C','dist/runtime-download']);
else execFileSync('powershell.exe',['-NoProfile','-Command',`Expand-Archive -LiteralPath 'dist/runtime-download/${archive}' -DestinationPath 'dist/runtime-download'`]);
const source=`dist/runtime-download/${base}`,dest=mac?'_toolchain/portable-node-macos-arm64':'_toolchain/node26';await mkdir(dest,{recursive:true});
await cp(`${source}/${mac?'bin/node':'node.exe'}`,`${dest}/${mac?'node':'node.exe'}`);await cp(`${source}/LICENSE`,`${dest}/LICENSE`);
console.log(`Verified portable Node ${version} copied to ${dest}`);

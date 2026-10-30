// Explicit release allowlist: never archive the whole reverse-engineering workspace.
import { cp, mkdir, readFile, writeFile, readdir, stat, chmod, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=process.argv[2] || 'source';
if(!['source','macos-arm64','windows-x64'].includes(target)) throw Error('Usage: node scripts/package-release.mjs source|macos-arm64|windows-x64');
const version=JSON.parse(await readFile(path.join(root,'app/package.json'))).version;
const name=`Rapoo-Local-${version}-${target}`, out=path.join(root,'dist'), stage=path.join(out,name);
// Refuse stale staging trees rather than accidentally shipping leftover files.
try { await access(stage); throw Error(`Staging folder already exists: ${stage}. Choose a new version or move it aside.`); } catch(e) { if(e.code!=='ENOENT')throw e; }
await mkdir(stage,{recursive:true});
async function files(dir){const entries=await readdir(path.join(root,dir),{withFileTypes:true});const list=[];for(const e of entries){const p=path.posix.join(dir,e.name);if(e.isDirectory())list.push(...await files(p));else list.push(p);}return list.sort();}
const appFiles=(await files('app')).filter(p=>!p.endsWith('/assets/mt760l.webp'));
const shared=['README.md','LICENSE','THIRD_PARTY_NOTICES.md','docs/FILES.md','docs/PUBLISHING.md','docs/DEVELOPMENT.md','research/PROTOCOL.md','research/BUTTONS-AND-SCROLL.md',...appFiles,'scripts/launch-app.mjs','scripts/decode-capture.mjs'];
const source=[...shared,'.gitignore','.github/workflows/release.yml','start-macos.command','start-windows.cmd','start-linux.sh','test-macos.command','docs/DEVELOPMENT.md',...(await files('packaging')),...(await files('scripts')).filter(p=>p!=='scripts/launch-app.mjs')];
const content=target==='source'?source:shared;
let dest=stage;
if(target==='macos-arm64'){
  const contents=path.join(stage,'Rapoo Local.app','Contents');dest=path.join(contents,'Resources');
  await mkdir(path.join(contents,'MacOS'),{recursive:true});
  await cp(path.join(root,'packaging/macos/Info.plist'),path.join(contents,'Info.plist'));
  await cp(path.join(root,'packaging/macos/RapooLocal'),path.join(contents,'MacOS/RapooLocal'));
  await chmod(path.join(contents,'MacOS/RapooLocal'),0o755);
}
for(const p of [...new Set(content)]){const to=path.join(dest,p);await mkdir(path.dirname(to),{recursive:true});await cp(path.join(root,p),to);}
if(target!=='source'){
  const runtime=target==='macos-arm64'?'_toolchain/portable-node-macos-arm64':'_toolchain/node26';
  for(const p of [target==='macos-arm64'?'node':'node.exe','LICENSE']){const to=path.join(dest,runtime,p);await mkdir(path.dirname(to),{recursive:true});await cp(path.join(root,runtime,p),to);}
  const launcher=target==='macos-arm64'?'start-macos.command':'start-windows.cmd';await cp(path.join(root,launcher),path.join(dest,launcher));
  if(target==='macos-arm64')await chmod(path.join(dest,launcher),0o755);
  if(target==='windows-x64' && process.platform==='win32'){
    execFileSync('powershell.exe',['-NoProfile','-File',path.join(root,'packaging/windows/build-launcher.ps1'),'-OutputPath',path.join(stage,'Rapoo Local.exe')],{stdio:'inherit'});
    const message=execFileSync(path.join(stage,'Rapoo Local.exe'),['--self-test'],{encoding:'utf8'});if(!message.includes('launcher OK'))throw Error('Windows launcher self-test failed');
  }
  await cp(path.join(root,'README.md'),path.join(stage,'README.md'));
  await writeFile(path.join(stage,'START-HERE.txt'),target==='macos-arm64'?'Extract the ZIP, then double-click Rapoo Local.app. This unsigned launcher opens Terminal and your browser. Keep Terminal open; Ctrl+C quits. Read README.md for permissions and limitations.\n':'Extract the entire ZIP. Run Rapoo Local.exe if present, otherwise start-windows.cmd. Keep the console open; Ctrl+C quits. Use Chrome or Edge for device control. Windows hardware support remains unverified.\nThis package was built '+(process.platform==='win32'?'on Windows and includes a compiled launcher.':'on macOS; the .exe launcher is built by the GitHub Windows workflow, so use the .cmd here.')+'\n');
}
async function manifest(dir,prefix=''){let result=[];for(const e of await readdir(dir,{withFileTypes:true})){const rel=path.posix.join(prefix,e.name),full=path.join(dir,e.name);if(e.isDirectory())result.push(...await manifest(full,rel));else result.push({path:rel,bytes:(await stat(full)).size,sha256:createHash('sha256').update(await readFile(full)).digest('hex')});}return result.sort((a,b)=>a.path.localeCompare(b.path));}
const entries=await manifest(stage);await writeFile(path.join(stage,'MANIFEST.json'),JSON.stringify({version,target,windowsExeIncluded:target==='windows-x64'&&process.platform==='win32',files:entries},null,2)+'\n');
const archive=path.join(out,`${name}.zip`);
if(process.platform==='win32'){
  const quote=s=>"'"+s.replaceAll("'","''")+"'";
  execFileSync('powershell.exe',['-NoProfile','-Command',`Compress-Archive -LiteralPath ${quote(stage)} -DestinationPath ${quote(archive)} -CompressionLevel Optimal`],{stdio:'inherit'});
}else execFileSync('/usr/bin/zip',['-q','-r',archive,name],{cwd:out,stdio:'inherit'});
const sha256=createHash('sha256').update(await readFile(archive)).digest('hex');await writeFile(`${archive}.sha256`,`${sha256}  ${path.basename(archive)}\n`);
console.log(`${archive}\n${entries.length} files; SHA-256 ${sha256}`);

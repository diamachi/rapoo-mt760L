// Explicit release boundary. Personal notes and original research inputs stay local.
import {cp,mkdir,readFile,writeFile,readdir,stat,chmod,access,symlink,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=process.argv[2]||'source';
if(!['source','macos-arm64','windows-x64'].includes(target))throw Error('Expected source, macos-arm64 or windows-x64');
if(target==='macos-arm64'&&process.platform!=='darwin')throw Error('Build the Mac app on macOS');
if(target==='windows-x64'&&process.platform!=='win32')throw Error('Build the Windows desktop app on Windows or GitHub Actions');
const {version}=JSON.parse(await readFile(path.join(root,'app/package.json'),'utf8'));
const name=`OpenRapoo-${version}-${target}`,out=path.join(root,'dist'),stage=path.join(out,name);
try{await access(stage);throw Error(`Staging folder exists: ${stage}. Bump the version or move the old build aside.`);}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(stage,{recursive:true});
async function files(dir){let result=[];for(const entry of await readdir(path.join(root,dir),{withFileTypes:true})){if(entry.name==='.DS_Store')continue;if(dir==='packaging/macos'&&!/\.(swift|plist)$/.test(entry.name))continue;const p=path.posix.join(dir,entry.name);if(entry.isDirectory())result.push(...await files(p));else if(!p.endsWith('.exe'))result.push(p);}return result.sort();}
const appFiles=await files('app');
const docs=['README.md','LICENSE','THIRD_PARTY_NOTICES.md','docs/FILES.md','docs/PUBLISHING.md','docs/DEVELOPMENT.md','docs/LOCAL-TESTING.md','docs/RELEASE-NOTES.md','research/PROTOCOL.md','research/BUTTONS-AND-SCROLL.md','research/POLLING-RATE.md','research/BATTERY.md'];
const runtimeFiles=appFiles.filter(file=>!file.startsWith('app/test/') && !file.endsWith('.swift') &&
  (target!=='windows-x64'||!file.startsWith('app/native/')));
const screenshots=await files('docs/screenshots');
const shared=['LICENSE','THIRD_PARTY_NOTICES.md',...runtimeFiles,'scripts/desktop-server.mjs'];
const source=[...docs,...screenshots,...appFiles,'AGENTS.md','.gitignore','.github/workflows/release.yml','start-macos.command','start-windows.cmd','start-linux.sh','test-macos.command',...await files('packaging'),...await files('scripts')];
let dest=stage;
if(target==='macos-arm64'){dest=path.join(stage,'OpenRapoo.app/Contents/Resources');await mkdir(path.join(stage,'OpenRapoo.app/Contents/MacOS'),{recursive:true});await cp(path.join(root,'packaging/macos/Info.plist'),path.join(stage,'OpenRapoo.app/Contents/Info.plist'));}
for(const p of new Set(target==='source'?source:shared)){const to=path.join(dest,p);await mkdir(path.dirname(to),{recursive:true});await cp(path.join(root,p),to);if(p.endsWith('.command')||p==='start-linux.sh')await chmod(to,0o755);}
if(target!=='source'){
  const runtime=target==='macos-arm64'?'portable-node-macos-arm64':'portable-node-windows-x64';
  for(const file of [target==='macos-arm64'?'node':'node.exe','LICENSE']){const to=path.join(dest,'_toolchain',runtime,file);await mkdir(path.dirname(to),{recursive:true});await cp(path.join(root,'_toolchain',runtime,file),to);}
  await writeFile(path.join(stage,'README.md'),`# OpenRapoo ${version}\n\n${target==='macos-arm64'?'Open the DMG and drag OpenRapoo to Applications. macOS 14+ on Apple silicon. Input Monitoring permission may be required; quit and reopen after granting it.':'Run the setup EXE, then open OpenRapoo from Start. Setup adds WebView2 if missing (internet needed for that prerequisite).'}\n\nThe app has its own window and bundles its Node runtime. Closing the window quits its local service. Packages are unsigned.\n\nSource, screenshots and portable build instructions: https://github.com/diamachi/rapoo-mt760L\n`);
  await writeFile(path.join(stage,'START-HERE.txt'),target==='macos-arm64'?'Open the DMG and drag OpenRapoo to Applications, then open it. The app has its own window. Close the window or press Command+Q to quit. No Terminal or external browser is used.\n':'Run the setup executable, then open OpenRapoo from Start. It has its own window and stops its service when closed. Setup adds WebView2 only if missing (internet required in that case).\n');
}
if(target==='macos-arm64'){
  await cp(path.join(root,'packaging/assets/AppIcon.icns'),path.join(dest,'AppIcon.icns'));
  const executable=path.join(stage,'OpenRapoo.app/Contents/MacOS/OpenRapoo');
  const cache=path.join(root,'_toolchain/build-cache/swift');await mkdir(cache,{recursive:true});
  execFileSync('/usr/bin/xcrun',['swiftc','-swift-version','5','-target','arm64-apple-macosx14.0','-module-cache-path',cache,'-file-prefix-map',`${root}=.`,'-O','-framework','AppKit','-framework','WebKit',path.join(root,'packaging/macos/main.swift'),'-o',executable],{stdio:'inherit'});
  execFileSync(executable,['--self-test'],{stdio:'inherit'});
  const rateHelper=path.join(dest,'app/native/macos-rate');
  execFileSync('/usr/bin/xcrun',['swiftc','-swift-version','5','-target','arm64-apple-macosx14.0','-module-cache-path',cache,'-file-prefix-map',`${root}=.`,'-O','-framework','IOKit',path.join(root,'app/native/macos-rate.swift'),'-o',rateHelper],{stdio:'inherit'});
  execFileSync(rateHelper,['--self-test'],{stdio:'inherit'});
}
if(target==='windows-x64'){
  execFileSync('powershell.exe',['-NoProfile','-File',path.join(root,'packaging/windows/build-launcher.ps1'),'-OutputDirectory',stage],{stdio:'inherit'});
}
async function manifest(dir,prefix=''){let result=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.posix.join(prefix,e.name),full=path.join(dir,e.name);if(e.isDirectory())result.push(...await manifest(full,p));else result.push({path:p,bytes:(await stat(full)).size,sha256:createHash('sha256').update(await readFile(full)).digest('hex')});}return result.sort((a,b)=>a.path.localeCompare(b.path));}
await writeFile(path.join(stage,'MANIFEST.json'),JSON.stringify({version,target,desktopWindow:target!=='source',files:await manifest(stage)},null,2)+'\n');
async function checksum(file){const hash=createHash('sha256').update(await readFile(file)).digest('hex');await writeFile(file+'.sha256',`${hash}  ${path.basename(file)}\n`);console.log(path.basename(file)+' SHA-256 '+hash);}
const archive=path.join(out,name+'.zip');
if(process.platform==='win32'){
  const quote=s=>"'"+s.replaceAll("'","''")+"'";
  execFileSync('powershell.exe',['-NoProfile','-Command',`Compress-Archive -LiteralPath ${quote(stage)} -DestinationPath ${quote(archive)} -CompressionLevel Optimal`],{stdio:'inherit'});
}else execFileSync('/usr/bin/zip',['-q','-r',archive,name],{cwd:out,stdio:'inherit'});
await checksum(archive);
if(target==='macos-arm64'){
  const dmgStage=path.join(out,'dmg-stage-'+version);await mkdir(dmgStage);
  try {await cp(path.join(stage,'OpenRapoo.app'),path.join(dmgStage,'OpenRapoo.app'),{recursive:true});await symlink('/Applications',path.join(dmgStage,'Applications'));const dmg=path.join(out,name+'.dmg');execFileSync('/usr/bin/hdiutil',['create','-volname','OpenRapoo','-srcfolder',dmgStage,'-format','UDZO',dmg],{stdio:'inherit'});await checksum(dmg);}finally{await rm(dmgStage,{recursive:true,force:true});}
}
if(target==='windows-x64'){
  const compiler=path.join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Inno Setup 6/ISCC.exe');
  const bootstrap=path.join(root,'_toolchain/webview2-sdk-1.0.4314.35/MicrosoftEdgeWebview2Setup.exe');
  execFileSync(compiler,[`/DAppVersion=${version}`,`/DAppDirectory=${stage}`,`/DOutputDirectory=${out}`,`/DBootstrapper=${bootstrap}`,path.join(root,'packaging/windows/installer.iss')],{stdio:'inherit'});
  await checksum(path.join(out,`OpenRapoo-${version}-windows-x64-setup.exe`));
}

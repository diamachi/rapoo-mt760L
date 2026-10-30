import { fromHex, toHex, decodeDpi, encodeDpi, capturedWrite, addressOf } from '/src/protocol.mjs';
import { WebHidTransport } from '/src/transport.mjs';
import { NativeMacTransport } from '/src/native-client.mjs';
import { BUTTONS, KEYS, actionsForButton, encodeButton } from '/src/buttons.mjs';
import { buildMouseMap } from '/mouse-map.mjs';
const $ = id => document.getElementById(id);
const logs = []; let packets = [], template, selected, busy = false;
let noticeTimer, developerMode=false, previewOnly=false;
function notice(message, error = false) {
  clearTimeout(noticeTimer);$('notice').hidden=false;$('notice').textContent=message;$('notice').classList.toggle('error',error);
  if(!error)noticeTimer=setTimeout(()=>$('notice').hidden=true,5000);
}
function updateThemeLabel(){const dark=document.documentElement.dataset.theme==='dark';$('theme-toggle').textContent=dark?'Light mode':'Dark mode';$('theme-toggle').setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');}
$('theme-toggle').addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('rapoo-theme',theme);}catch{}updateThemeLabel();});
updateThemeLabel();
function setDeveloper(enabled){developerMode=enabled;document.documentElement.dataset.developer=String(enabled);$('developer-mode').checked=enabled;if(!enabled){previewOnly=false;$('preview-only').checked=false;}document.documentElement.dataset.preview=String(previewOnly);updateMode();}
$('developer-mode').addEventListener('change',()=>setDeveloper($('developer-mode').checked));
$('preview-only').addEventListener('change',()=>{previewOnly=$('preview-only').checked;document.documentElement.dataset.preview=String(previewOnly);updateMode();});
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.shiftKey&&event.key.toLowerCase()==='d'){event.preventDefault();setDeveloper(!developerMode);}});
function log(kind, detail) {
  const entry = { time: new Date().toISOString(), kind, detail }; logs.push(entry);
  const row = document.createElement('div'); row.className = 'log';
  const time = document.createElement('time'); time.textContent = new Date(entry.time).toLocaleTimeString();
  const title = document.createElement('strong'); title.textContent = kind;
  const text = document.createElement('code'); text.textContent = detail;
  row.append(time, title, text); $('logs').prepend(row);
  if (logs.length > 500) { logs.shift(); $('logs').lastElementChild.remove(); }
  $('log-count').textContent=`${logs.length} entries`;
}
let transport = new WebHidTransport(navigator.hid, log), nativeMode = false;
function disconnected() { $('connect').hidden = false; $('disconnect').hidden = true; $('device-state').textContent = 'Receiver disconnected'; updateMode(); }
transport.onLost = disconnected;
async function localRequest(path, options) {
  const response = await fetch(path, options ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Rapoo-Token': options.token }, body: JSON.stringify(options.body) } : undefined);
  const data = await response.json(); if (!response.ok || data.error) throw Error(data.error || 'Local device request failed'); return data;
}
function connectionError(e) {
  if (nativeMode && /HID access|configuration interface/i.test(e.message) && /not permitted|denied|0xe00002e2/i.test(e.message)) {
    $('device-state').textContent = 'Receiver detected · macOS access denied';
    $('permission-help').hidden = false;
  }
}
async function run(action) {
  if (busy) return; busy = true;
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  try { await action(); } catch (e) { connectionError(e); notice(e.message, true); log('ERROR', e.message); }
  finally { busy = false; document.querySelectorAll('button').forEach(b => b.disabled = false); }
}
function download(name, data) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function settings() { return { stages: Array.from($('stage-inputs').querySelectorAll('input'), i => Number(i.value)), count: Number($('count').value), current: Number($('current').value) }; }
function preview() {
  try { $('dpi-bytes').textContent = toHex(encodeDpi(template, settings())); }
  catch (e) { $('dpi-bytes').textContent = e.message; }
  const state=settings();
  Array.from($('stages').children).forEach((el,i)=>{const active=i+1===state.current,enabled=i<state.count;el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));el.setAttribute('aria-disabled',String(!enabled));el.setAttribute('aria-label',`${state.stages[i]} DPI · stage ${i+1}${enabled?'':' · disabled'}`);el.querySelector('strong').textContent=state.stages[i];el.querySelector('span').textContent=enabled?(active?'Selected':'DPI'):'Disabled';});
  $('dpi-current-label').textContent=`${state.stages[state.current-1]??'—'} DPI`;
}
function loadDpi(packet, useSaved=false) {
  template = fromHex(packet.payload);let dpi=decodeDpi(template);
  if(useSaved){try{const saved=JSON.parse(localStorage.getItem('rapoo-dpi-profile'));encodeDpi(template,saved);dpi=saved;}catch{}}
  $('stages').replaceChildren();$('stage-inputs').replaceChildren();
  dpi.stages.forEach((value, i) => {
    const el = document.createElement('label');
    const input = document.createElement('input'); Object.assign(input, { id: `dpi-${i}`, type: 'number', min: '50', max: '4000', step: '50', value: String(value) }); input.addEventListener('input', preview);
    el.append(document.createTextNode(`Stage ${i+1}`),input);$('stage-inputs').append(el);
    const stage=document.createElement('button');stage.type='button';stage.className='dpi-stage';
    const title=document.createElement('small');title.textContent=`STAGE 0${i+1}`;const number=document.createElement('strong');number.textContent=value;const status=document.createElement('span');stage.append(title,number,status);
    stage.addEventListener('click',()=>run(async()=>{if(i>=Number($('count').value))return;const previous=$('current').value;$('current').value=i+1;preview();try{await sendOrPreview(encodeDpi(template,settings()),`${settings().stages[i]} DPI`);}catch(error){$('current').value=previous;preview();throw error;}}));$('stages').append(stage);
  });
  $('count').value = dpi.count; $('current').value = dpi.current; preview();
  if(!useSaved)notice(`Loaded capture frame ${packet.frame} into the app profile. No settings sent.`);
}
function updateMode() {
  $('apply').textContent=previewOnly?'Preview DPI settings':'Apply DPI settings';
  $('replay').textContent=previewOnly?'Preview captured write':'Replay captured write';
  document.querySelectorAll('.button-apply').forEach(b=>b.textContent=previewOnly?'Preview action':'Apply action');
}
function renderButtons() {
  const selectButton=id=>{
    $('button-target').value=String(id);
    document.querySelectorAll('.button-row').forEach(row=>row.hidden=Number(row.dataset.inputId)!==id);
    document.querySelectorAll('.mouse-pin').forEach(pin=>pin.setAttribute('aria-pressed',String(Number(pin.dataset.inputId)===id)));
    $('selected-input-number').textContent=`INPUT ${String(id+1).padStart(2,'0')}`;
  };
  const target=document.createElement('select');target.id='button-target';target.setAttribute('aria-label','Selected mouse input');
  for(const button of BUTTONS){const option=document.createElement('option');option.value=button.id;option.textContent=`${String(button.id+1).padStart(2,'0')} · ${button.name}`;target.append(option);}
  target.addEventListener('change',()=>selectButton(Number(target.value)));$('button-target-container').append(target);
  buildMouseMap($('mouse-map'),BUTTONS,id=>{selectButton(id);if(matchMedia('(max-width:1050px)').matches)document.querySelector('.button-panel').scrollIntoView({behavior:'smooth',block:'nearest'});});
  for (const button of BUTTONS) {
    const row=document.createElement('div');row.className='button-row';row.dataset.inputId=button.id;
    const heading=document.createElement('div'),name=document.createElement('h3'),info=document.createElement('small');
    name.textContent=button.name;info.textContent='Suggested starting action';heading.append(name,info);
    const action=document.createElement('select');action.id=`button-action-${button.id}`;action.setAttribute('aria-label',`${button.name} action`);
    for(const item of actionsForButton(button.id)) {const option=document.createElement('option');option.value=item.id;option.textContent=item.name;action.append(option);} action.value=button.defaultAction;
    const shortcut=document.createElement('div');shortcut.className='shortcut';shortcut.hidden=true;
    const modifiers=[];
    for(const [label,bit] of [['Control',1],['Shift',2],['Alt / Option',4],['Win / Command',8]]) {
      const field=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=bit===(navigator.platform.includes('Mac')?8:1);input.dataset.bit=bit;modifiers.push(input);field.append(input,document.createTextNode(label));shortcut.append(field);
    }
    const key=document.createElement('select');key.setAttribute('aria-label',`${button.name} shortcut key`);
    for(const item of KEYS){const option=document.createElement('option');option.value=item.code;option.textContent=item.name;key.append(option);}key.value=6;shortcut.append(key);
    const code=document.createElement('code');code.className='button-bytes';
    const state=()=>({key:Number(key.value),modifiers:modifiers.reduce((n,x)=>n+(x.checked?Number(x.dataset.bit):0),0)});
    const refresh=()=>{shortcut.hidden=action.value!=='shortcut';code.textContent=toHex(encodeButton(button.id,action.value,state()));};
    action.addEventListener('change',refresh);key.addEventListener('change',refresh);modifiers.forEach(x=>x.addEventListener('change',refresh));
    const apply=document.createElement('button');apply.className='button-apply';apply.textContent='Apply action';
    apply.addEventListener('click',()=>run(async()=>{await sendOrPreview(encodeButton(button.id,action.value,state()),`${button.name} → ${action.selectedOptions[0].textContent}`);info.textContent=previewOnly?'Previewed · no write':'Action sent to mouse';}));
    const reset=document.createElement('button');reset.textContent='Reset selection';reset.addEventListener('click',()=>{action.value=button.defaultAction;refresh();info.textContent='Starting action selected · click Apply action to send';});
    const controls=document.createElement('div');controls.className='button-controls';controls.append(action);const applyRow=document.createElement('div');applyRow.className='button-apply-row';applyRow.append(apply,reset);
    const details=document.createElement('details');details.className='button-command developer-only';const summary=document.createElement('summary');summary.textContent='Command preview';details.append(summary,code);
    row.append(heading,controls,shortcut,applyRow,details);$('button-editor').append(row);refresh();
  }
  selectButton(0);
}
function renderScroll(state) {
  $('scroll-state').textContent=state?.running?`Running · ${state.lines} lines`:'Stopped';
  if(state?.running)$('scroll-lines').value=state.lines;
}
setInterval(async()=>{if(nativeMode&&$('scroll-state').textContent.startsWith('Running')){try{renderScroll(await localRequest('/api/native/scroll-status'));}catch{}}},3000);
$('scroll-start').addEventListener('click',()=>run(async()=>{
  if(!nativeMode)throw Error('Fixed-line scrolling currently requires the local macOS helper.');
  const lines=Number($('scroll-lines').value);if(!Number.isInteger(lines)||lines<1||lines>100)throw Error('Choose 1–100 lines per wheel notch');
  try {const status=await localRequest('/api/native/scroll-start',{token:transport.token,body:{lines}});renderScroll(status);log('SCROLL HELPER STARTED',`${lines} logical lines per raw vertical HID wheel increment · all mouse wheels · trackpad unchanged`);notice('Fixed-line scrolling is running. Use Stop to restore normal scrolling.');}
  catch(error){$('scroll-help').textContent=error.message;throw error;}
}));
$('scroll-stop').addEventListener('click',()=>run(async()=>{
  if(!nativeMode)return;
  renderScroll(await localRequest('/api/native/scroll-stop',{token:transport.token,body:{}}));log('SCROLL HELPER STOPPED','Normal mouse scrolling restored.');notice('Fixed-line scrolling stopped.');
}));
async function sendOrPreview(bytes, label) {
  if (previewOnly) { log('PREVIEW · NO DEVICE WRITE', `${label} · ${toHex(bytes)}`); notice('Preview recorded in Developer tools. Nothing sent.'); return; }
  if(!transport.device)await connectMouse();
  await transport.send(bytes);
  if(addressOf(bytes)===0x638){try{localStorage.setItem('rapoo-dpi-profile',JSON.stringify(decodeDpi(bytes)));}catch{}}
  notice(`${label} sent to mouse.`);
}
function inspect(p) {
  selected = p; $('inspection').hidden = false;
  $('inspection-title').textContent = `FRAME ${p.frame} · ${p.setup ? JSON.stringify(p.setup) : 'USB payload'}`;
  $('inspection-bytes').textContent = p.payload || p.data || 'No payload';
  $('load-template').hidden = !(capturedWrite(p) && addressOf(fromHex(p.payload)) === 0x638);
  $('replay').hidden = !capturedWrite(p);
}
function renderPackets() {
  $('packets').replaceChildren();
  for (const p of packets.filter(p => $('filter').value === 'all' || ($('filter').value === 'writes' ? capturedWrite(p) : p.setup?.requestType === 0xa1))) {
    const tr = document.createElement('tr'); let address = '—', op = 'USB setup';
    if (p.payload?.startsWith('baa5')) { address = '0x' + addressOf(fromHex(p.payload)).toString(16).padStart(4, '0'); op = p.payload.slice(4, 6) === 'a5' ? 'Write' : 'Read command'; }
    else if (p.setup?.requestType === 0xa1) op = 'GET_REPORT · Input';
    for (const value of [p.frame, op, address, p.payload || JSON.stringify(p.setup)]) { const td = document.createElement('td'); td.textContent = value; tr.append(td); }
    const td = document.createElement('td'), button = document.createElement('button'); button.textContent = 'View'; button.addEventListener('click', () => inspect(p)); td.append(button); tr.append(td); $('packets').append(tr);
  }
}
async function connectMouse(){
  const device = await transport.connect();updateMode();
  $('device-state').textContent = 'Connected · 2.4 GHz receiver';
  $('connect').hidden = true; $('disconnect').hidden = false;
  $('permission-help').hidden = true;
  log('CONNECTED', `${device.productName} · ${device.vendorId.toString(16)}:${device.productId.toString(16)}. Connection opened; no commands sent.`);
  return device;
}
$('connect').addEventListener('click',()=>run(async()=>{await connectMouse();notice('Mouse connected. Choose a DPI stage or apply a button action.');}));
$('disconnect').addEventListener('click', () => run(async () => { await transport.close(); disconnected(); notice('Disconnected. Preview mode is active.'); }));
$('apply').addEventListener('click', () => run(() => sendOrPreview(encodeDpi(template, settings()), 'DPI block 0x638')));
$('count').addEventListener('change',()=>{if(Number($('current').value)>Number($('count').value))$('current').value=$('count').value;preview();});
$('filter').addEventListener('change', renderPackets);
$('load-template').addEventListener('click', () => { loadDpi(selected); $('dpi').scrollIntoView({ behavior: 'smooth' }); });
$('replay').addEventListener('click', () => run(() => sendOrPreview(fromHex(selected.payload), `Captured frame ${selected.frame}`)));
$('export-log').addEventListener('click', () => download('rapoo-session.json', logs));
$('export-capture').addEventListener('click', () => download('rapoo-capture-decoded.json', packets));
$('descriptor').addEventListener('click', () => run(async () => {
  if (nativeMode) { const status = await transport.status(); download('rapoo-native-device-details.json', { available: status.available, devices: status.devices, error: status.error }); return; }
  const device = transport.device;
  if (!device) {
    if (!navigator.hid) throw Error('Open in desktop Chrome or Edge to inspect a device');
    const [chosen] = await navigator.hid.requestDevice({ filters: [] });
    if (!chosen) return;
    download('rapoo-device-details.json', { productName: chosen.productName, vendorId: chosen.vendorId, productId: chosen.productId, collections: chosen.collections }); return;
  }
  download('rapoo-device-details.json', { productName: device.productName, vendorId: device.vendorId, productId: device.productId, collections: device.collections });
}));
$('support').textContent = navigator.hid ? 'WebHID available · select the USB receiver' : 'Device control needs desktop Chrome / Edge. Preview works here.';
await run(async () => {
  const response = await fetch('/api/capture'); if (!response.ok) throw Error('Could not load the supplied capture');
  packets = await response.json(); loadDpi(packets.find(p => p.frame === 12),true); renderPackets();
  renderButtons();
  const native = new NativeMacTransport(localRequest, log);
  const status = await native.status();
  if (status.available) {
    transport = native; nativeMode = true;
    renderScroll(status.scroll);
    const receiver = status.devices?.find(d => d.compatible);
    $('support').textContent = 'Direct macOS HID · no browser device chooser required';
    if (receiver) {
      $('device-state').textContent = '2.4 GHz receiver detected · 24ae:1870';
      log('RECEIVER DETECTED', `${receiver.productName} · configuration report BA · ${status.devices.length} HID interfaces. Click Connect receiver to test access.`);
      await connectMouse();
    } else {
      $('device-state').textContent = 'Receiver not detected by macOS';
      notice(status.error || 'Plug in the MT760L 2.4 GHz USB receiver, then click Connect receiver to scan again.', Boolean(status.error));
    }
  }
  log('APP READY', `${packets.length} capture packets loaded. App profile displayed. No settings sent during startup.`);
});

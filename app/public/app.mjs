import { fromHex, toHex, decodeDpi, encodeDpi, capturedWrite, addressOf } from '/src/protocol.mjs';
import { WebHidTransport } from '/src/transport.mjs';
import { NativeTransport } from '/src/native-client.mjs';
import { BUTTONS, KEYS, actionsForButton, encodeButton, requiresPrimaryClickConsent } from '/src/buttons.mjs';
import { POLLING_RATES, encodePolling } from '/src/polling.mjs';
import { buildMouseMap } from '/mouse-map.mjs';
import { createActionPicker } from '/action-picker.mjs';
const $ = id => document.getElementById(id);
const logs = []; let packets = [], template, selected, busy = false;
let packetsRendered=false;
let noticeTimer, developerMode=false, previewOnly=false, measurementAvailable=false, batteryBusy=false;
function notice(message, error = false) {
  clearTimeout(noticeTimer);$('notice').hidden=false;$('notice').textContent=message;$('notice').classList.toggle('error',error);
  if(!error)noticeTimer=setTimeout(()=>$('notice').hidden=true,5000);
}
function updateThemeLabel(){const dark=document.documentElement.dataset.theme==='dark';$('theme-toggle').textContent=dark?'Light mode':'Dark mode';$('theme-toggle').setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');}
$('theme-toggle').addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('rapoo-theme',theme);}catch{}updateThemeLabel();});
updateThemeLabel();
function setDeveloper(enabled){if(enabled&&!packetsRendered&&packets.length)renderPackets();developerMode=enabled;document.documentElement.dataset.developer=String(enabled);$('developer-mode').checked=enabled;if(!enabled){previewOnly=false;$('preview-only').checked=false;}document.documentElement.dataset.preview=String(previewOnly);updateMode();}
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
let transport = new WebHidTransport(navigator.hid, log), nativeMode = false, nativePlatform = null;
function disconnected() { $('connect').hidden = false; $('disconnect').hidden = true; $('device-state').textContent = 'Receiver disconnected';$('battery-label').textContent='Battery —';$('battery-state').title='Reconnect the mouse to read its battery';$('battery-state').classList.remove('low');$('battery-refresh').disabled=true; updateMode(); }
transport.onLost = disconnected;
async function localRequest(path, options) {
  const response = await fetch(path, options ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Rapoo-Token': options.token }, body: JSON.stringify(options.body) } : undefined);
  const data = await response.json(); if (!response.ok || data.error) throw Error(data.error || 'Local device request failed'); return data;
}
function connectionError(e) {
  if (nativePlatform === 'darwin' && /HID access|configuration interface|mouse-report measurement/i.test(e.message) && /not permitted|denied|0xe00002e2/i.test(e.message)) {
    $('device-state').textContent = 'Receiver detected · macOS access denied';
    $('permission-help').hidden = false;
    return true;
  }
}
async function run(action) {
  if (busy) return; busy = true;
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  try { await action(); } catch (e) { const permission=connectionError(e); notice(permission?'Receiver access needs Input Monitoring permission. Follow the instructions below, then quit and reopen the preview or app.':e.message, true); log('ERROR', e.message); }
  finally { busy = false; document.querySelectorAll('button').forEach(b => b.disabled = false); $('measure-rate').disabled=!measurementAvailable;syncPrimaryEditors();$('battery-refresh').disabled=!nativeMode||!transport.device||batteryBusy; }
}
async function refreshBattery() {
  if(batteryBusy || !nativeMode || !transport.device)return;
  batteryBusy=true;$('battery-refresh').disabled=true;
  try {
    const result=await transport.battery();
    if(!Number.isInteger(result.percent)||result.percent<0||result.percent>100)throw Error('Mouse returned an invalid percentage');
    $('battery-label').textContent=`${result.percent}% battery`;
    $('battery-state').title=`Reported by mouse · updated ${new Date(result.updatedAt).toLocaleTimeString()}`;
    $('battery-state').classList.toggle('low',result.percent<=20);
    log('BATTERY',`${result.percent}% · mouse-reported · ${result.updatedAt}`);
  } catch(error) {
    $('battery-label').textContent='Battery unavailable';$('battery-state').title=error.message;
    $('battery-state').classList.remove('low');log('BATTERY UNAVAILABLE',error.message);
  } finally {batteryBusy=false;$('battery-refresh').disabled=busy||!transport.device;}
}
$('battery-refresh').addEventListener('click',()=>run(refreshBattery));
setInterval(()=>{if(!busy && !document.hidden)refreshBattery();},60000);
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
const primaryEditors=[];
function syncPrimaryEditors(){primaryEditors.forEach(editor=>editor.sync());}
function renderButtons() {
  const selectButton=id=>{
    document.querySelectorAll('.action-picker-popup').forEach(popup=>{if(!popup.hidden)popup.previousElementSibling?.click();});
    primaryEditors.forEach(editor=>{editor.unlock.checked=false;editor.sync();});
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
    const groups=new Map();
    for(const item of actionsForButton(button.id)) {
      if(!groups.has(item.group)){const group=document.createElement('optgroup');group.label=item.group;groups.set(item.group,group);action.append(group);}
      const option=document.createElement('option');option.value=item.id;option.textContent=item.name;groups.get(item.group).append(option);
    }
    action.value=button.defaultAction;
    const picker=createActionPicker(action,button.name);
    const protectedClick=button.id===0||button.id===2;
    const unlock=document.createElement('input');unlock.type='checkbox';unlock.className='primary-click-unlock';unlock.id=`unlock-click-${button.id}`;
    const protection=document.createElement('div');protection.className='primary-protection';protection.hidden=!protectedClick;
    const unlockLabel=document.createElement('label');unlockLabel.htmlFor=unlock.id;unlockLabel.append(unlock,document.createTextNode(`Unlock ${button.name.toLowerCase()} assignment`));
    const warning=document.createElement('p');warning.textContent='Changing this can remove a normal click. Keep another way to control the mouse available.';protection.append(unlockLabel,warning);
    const shortcut=document.createElement('div');shortcut.className='shortcut';shortcut.hidden=true;
    const modifiers=[];
    for(const [label,bit] of [['Control',1],['Shift',2],['Alt / Option',4],['Win / Command',8]]) {
      const field=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=bit===(navigator.platform.includes('Mac')?8:1);input.dataset.bit=bit;modifiers.push(input);field.append(input,document.createTextNode(label));shortcut.append(field);
    }
    const key=document.createElement('select');key.setAttribute('aria-label',`${button.name} shortcut key`);
    for(const item of KEYS){const option=document.createElement('option');option.value=item.code;option.textContent=item.name;key.append(option);}key.value=6;shortcut.append(key);
    const code=document.createElement('code');code.className='button-bytes';
    const state=()=>({key:Number(key.value),modifiers:modifiers.reduce((n,x)=>n+(x.checked?Number(x.dataset.bit):0),0)});
    const refresh=()=>{picker.sync();shortcut.hidden=action.value!=='shortcut';code.textContent=toHex(encodeButton(button.id,action.value,state()));};
    action.addEventListener('change',refresh);key.addEventListener('change',refresh);modifiers.forEach(x=>x.addEventListener('change',refresh));
    const apply=document.createElement('button');apply.className='button-apply';apply.textContent='Apply action';
    const syncProtection=()=>{if(!protectedClick)return;action.disabled=!unlock.checked;picker.sync();shortcut.querySelectorAll('input,select').forEach(field=>field.disabled=!unlock.checked);apply.disabled=busy||(requiresPrimaryClickConsent(encodeButton(button.id,action.value,state()))&&!unlock.checked);};
    if(protectedClick)primaryEditors.push({unlock,sync:syncProtection});
    unlock.addEventListener('change',syncProtection);action.addEventListener('change',syncProtection);
    apply.addEventListener('click',()=>run(async()=>{
      await sendOrPreview(encodeButton(button.id,action.value,state()),`${button.name} → ${action.selectedOptions[0].textContent}`,{confirmPrimaryClick:protectedClick&&unlock.checked});
      info.textContent=previewOnly?'Previewed · no write':'Action sent to mouse';unlock.checked=false;syncProtection();
    }));
    const reset=document.createElement('button');reset.textContent='Reset selection';reset.addEventListener('click',()=>{action.value=button.defaultAction;unlock.checked=false;refresh();syncProtection();info.textContent='Starting action selected · click Apply action to send';});
    const controls=document.createElement('div');controls.className='button-controls';const actionLabel=document.createElement('label');actionLabel.className='action-field';actionLabel.htmlFor=picker.trigger.id;const actionTitle=document.createElement('span');actionTitle.textContent='Assign an action';actionLabel.append(actionTitle,action,picker.element);controls.append(actionLabel);const applyRow=document.createElement('div');applyRow.className='button-apply-row';applyRow.append(apply,reset);
    const details=document.createElement('details');details.className='button-command developer-only';const summary=document.createElement('summary');summary.textContent='Command preview';details.append(summary,code);
    row.append(heading,protection,controls,shortcut,applyRow,details);$('button-editor').append(row);refresh();
  }
  selectButton(0);
}
function renderPolling() {
  for(const hz of POLLING_RATES){
    const button=document.createElement('button');button.type='button';button.className='polling-rate';button.textContent=hz+' Hz';button.setAttribute('aria-pressed','false');
    button.addEventListener('click',()=>run(async()=>{
      const packet=packets.find(p=>p.payload?.startsWith('baa5a50430060000'));
      await sendOrPreview(encodePolling(hz,packet?fromHex(packet.payload):undefined),hz+' Hz polling rate');
      if(!previewOnly){document.querySelectorAll('.polling-rate').forEach(el=>{const active=el===button;el.setAttribute('aria-pressed',String(active));el.classList.toggle('selected',active);});$('polling-current').textContent=hz+' Hz requested · unverified';$('rate-test-result').textContent='Rate command sent. Run a new measurement while moving continuously to check its effect.';}
    }));$('polling-rates').append(button);
  }
}
$('measure-rate').addEventListener('click',()=>run(async()=>{
  $('measure-rate').textContent='Measuring… keep moving';
  $('rate-test-result').textContent='Move the MT760L continuously in circles for six seconds. You can move outside this window.';
  try {
    const result=await localRequest('/api/native/measure-rate',{token:transport.token,body:{}});
    log('READ-ONLY RATE MEASUREMENT',JSON.stringify(result));
    $('rate-test-result').textContent=result.sufficient
      ? `Observed ≈ ${Math.round(result.medianHz)} Hz · median ${result.medianMs.toFixed(2)} ms · active mean ${Math.round(result.meanHz)} Hz. Middle 80%: ${result.p10Ms.toFixed(2)}–${result.p90Ms.toFixed(2)} ms. ${result.intervals} intervals; ${result.excludedIntervals} pauses/outliers excluded. This does not read the configured setting.`
      : `Too little movement to estimate a rate (${result.movementReports} moving reports). Keep the mouse moving continuously for the whole test and retry.`;
  } catch(error) { $('rate-test-result').textContent=error.message;if(nativePlatform==='darwin' && /denied|Input Monitoring/i.test(error.message))$('permission-help').hidden=false; throw error; }
  finally { $('measure-rate').textContent='Measure actual reports · 6 seconds'; }
}));
async function sendOrPreview(bytes, label, {confirmPrimaryClick=false}={}) {
  if(requiresPrimaryClickConsent(bytes)&&!confirmPrimaryClick)throw Error('Unlock the Left or Right button assignment in the button editor before changing its normal click.');
  if (previewOnly) { log('PREVIEW · NO DEVICE WRITE', `${label} · ${toHex(bytes)}`); notice('Preview recorded in Developer tools. Nothing sent.'); return; }
  if(!transport.device)await connectMouse();
  await transport.send(bytes,{confirmPrimaryClick});
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
  packetsRendered=true;
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
  await refreshBattery();
  return device;
}
$('connect').addEventListener('click',()=>run(async()=>{await connectMouse();notice('Mouse connected. Choose a DPI stage or apply a button action.');}));
$('disconnect').addEventListener('click', () => run(async () => { await transport.close(); disconnected(); notice('Disconnected. Applying a setting reconnects the receiver.'); }));
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
  const info=await(await fetch('/api/info')).json();$('local-preview').hidden=!info.development;
  const response = await fetch('/api/capture'); if (!response.ok) throw Error('Could not load the supplied capture');
  packets = await response.json(); loadDpi(packets.find(p => p.frame === 12),true);
  renderButtons(); renderPolling();
  const native = new NativeTransport(localRequest, log);
  const status = await native.status();
  measurementAvailable=Boolean(status.measurementAvailable);
  $('rate-test-support').textContent=measurementAvailable?'Native macOS HID · read only':'Native measurement is currently available in the local Mac preview.';
  if (status.available) {
    transport = native; nativeMode = true; nativePlatform = status.platform;
    const receiver = status.devices?.find(d => d.compatible);
    $('support').textContent = 'Native '+(status.platform==='win32'?'Windows':'macOS')+' HID · receiver access';
    if (receiver) {
      $('device-state').textContent = '2.4 GHz receiver detected · 24ae:1870';
      log('RECEIVER DETECTED', `${receiver.productName} · configuration report BA · ${status.devices.length} HID interfaces. No settings sent during connection.`);
      await connectMouse();
    } else {
      $('device-state').textContent = 'Receiver not detected';
      notice(status.error || 'Plug in the MT760L 2.4 GHz USB receiver, then click Connect receiver to scan again.', Boolean(status.error));
    }
  }
  log('APP READY', `${packets.length} capture packets loaded. App profile displayed. No settings sent during startup.`);
});

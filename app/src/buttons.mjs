// MT760 profile recovered from A HUB.exe qCompress resource at 0x11349761.
// Packet encoding traced through RapooDevice.dll VA 0x6feb0e20–0x6feb1e83.
import { validateReport, addressOf } from './protocol.mjs';
import { validPolling } from './polling.mjs';
export const BUTTONS = [
  { id: 0, name: 'Left button', defaultAction: 'left' },
  { id: 1, name: 'Middle / wheel click', defaultAction: 'middle' },
  { id: 2, name: 'Right button', defaultAction: 'right' },
  { id: 3, name: 'DIY button', defaultAction: 'diy' },
  { id: 4, name: 'DPI button', defaultAction: 'dpi-cycle' },
  { id: 5, name: 'Side button · forward', defaultAction: 'forward' },
  { id: 6, name: 'Side button · back', defaultAction: 'back' },
  { id: 7, name: 'Thumb wheel · left', defaultAction: 'scroll-left', wheel: true },
  { id: 8, name: 'Thumb wheel · right', defaultAction: 'scroll-right', wheel: true },
  { id: 9, name: 'Main wheel · up', defaultAction: 'scroll-up', wheel: true },
  { id: 10, name: 'Main wheel · down', defaultAction: 'scroll-down', wheel: true },
];
const action = (id, name, bytes, group, options = {}) => ({ id, name, bytes, group, ...options });
export const ACTIONS = [
  ...[['left','Left click',1],['right','Right click',2],['middle','Middle click',4],['back','Back',8],['forward','Forward',16]].map(([id,name,mask]) => action(id,name,[3,0,mask,0],'Mouse')),
  action('double-click','Double left click',[3,0,1,1],'Mouse'),
  action('scroll-up','Scroll up',[11,0,1,0],'Scrolling',{wheelOnly:true}),
  action('scroll-down','Scroll down',[11,0,2,0],'Scrolling',{wheelOnly:true}),
  action('scroll-left','Scroll left',[12,0,1,255],'Scrolling',{wheelOnly:true}),
  action('scroll-right','Scroll right',[12,0,2,255],'Scrolling',{wheelOnly:true}),
  ...[['dpi-cycle','Cycle DPI up',3],['dpi-cycle-down','Cycle DPI down',4],['dpi-up','Increase DPI',5],['dpi-down','Decrease DPI',6]].map(([id,name,code]) => action(id,name,[8,0,code,0],'Device',{noWheel:true})),
  action('diy','DIY / report-rate cycle',[10,0,0,0],'Device',{noWheel:true}),
  ...[['play','Play / pause',0xcd],['next','Next track',0xb5],['previous','Previous track',0xb6],['mute','Mute',0xe2],['volume-up','Volume up',0xe9],['volume-down','Volume down',0xea],['brightness-up','Brightness up',0x6f],['brightness-down','Brightness down',0x70]].map(([id,name,code]) => action(id,name,[4,0,code>>8,code&255],'Media')),
  action('shortcut','Keyboard shortcut…',null,'Keyboard'),
  action('disabled','Disable this input',[7,0,0,0],'Other'),
];
export const KEYS = [
  ...Array.from({length:26},(_,i)=>({code:i+4,name:String.fromCharCode(65+i)})),
  ...Array.from({length:9},(_,i)=>({code:i+30,name:String(i+1)})), {code:39,name:'0'},
  ...[[40,'Return'],[41,'Escape'],[42,'Backspace'],[43,'Tab'],[44,'Space'],[45,'-'],[46,'='],[47,'['],[48,']'],[49,'\\'],[51,';'],[52,"'"],[54,','],[55,'.'],[56,'/'],[74,'Home'],[75,'Page Up'],[76,'Delete'],[77,'End'],[78,'Page Down'],[79,'Right arrow'],[80,'Left arrow'],[81,'Down arrow'],[82,'Up arrow']].map(([code,name])=>({code,name})),
  ...Array.from({length:12},(_,i)=>({code:58+i,name:`F${i+1}`})),
];
export function actionsForButton(id) {
  const button = BUTTONS.find(b=>b.id===id); if (!button) throw Error('Unknown button');
  return ACTIONS.filter(a=>(!a.wheelOnly || button.wheel) && (!a.noWheel || !button.wheel));
}
export function encodeButton(id, actionId, { key = 6, modifiers = 8 } = {}) {
  const selected = actionsForButton(id).find(a=>a.id===actionId); if (!selected) throw Error('Action is not supported for this input');
  let bytes = selected.bytes;
  if (actionId === 'shortcut') {
    if (!KEYS.some(k=>k.code===key) || !Number.isInteger(modifiers) || modifiers<0 || modifiers>15) throw Error('Invalid keyboard shortcut');
    bytes = modifiers ? [2,0,modifiers,key] : [1,0,key,0];
  }
  const report = new Uint8Array(32); report.set([0xba,0xa5,0xa5,4]);
  new DataView(report.buffer).setUint32(4,0x600+id*4,true); report.set(bytes,8); return report;
}
export function allowedParameterWrite(report) {
  validateReport(report); const address = addressOf(report);
  if (report[2] !== 0xa5) return false;
  if (address === 0x630) return validPolling(report);
  if ([0x638,0x648].includes(address)) return true;
  if (address<0x600 || address>0x628 || (address-0x600)%4 || report[3]!==4) return false;
  const id = (address-0x600)/4, body = Array.from(report.slice(8,12));
  if (report.slice(12).some(x=>x!==0)) return false;
  if (actionsForButton(id).some(a=>a.bytes && a.bytes.every((x,i)=>x===body[i]))) return true;
  if (body[1]!==0) return false;
  if (body[0]===1) return KEYS.some(k=>k.code===body[2]) && body[3]===0;
  if (body[0]===2) return body[2]>0 && body[2]<=15 && KEYS.some(k=>k.code===body[3]);
  // Preserve replay of frame 104 (sniper) without exposing an unconfigured sniper editor.
  return address===0x610 && body.join(',')==='9,0,1,0';
}
export function requiresPrimaryClickConsent(report) {
  validateReport(report);
  const address=addressOf(report);
  if(address!==0x600 && address!==0x608)return false;
  const normal=address===0x600?[3,0,1,0]:[3,0,2,0];
  return !normal.every((byte,index)=>report[8+index]===byte);
}

// Raw HID wheel counts -> fixed logical line events. No installation or OS preference change.
// Only pointer-wheel usage values and scroll events are handled; no keyboard callbacks.
import { DynamicLibrary, getUint64 } from 'node:ffi';
import { validateLines, lineDelta } from '../src/scroll.mjs';
const selfTest=process.argv[2]==='--self-test',checkBindings=process.argv[2]==='--check-bindings',lines=selfTest||checkBindings?3:validateLines(Number(process.argv[2]));
const cg=new DynamicLibrary('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics');
const cf=new DynamicLibrary('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation');
const io=new DynamicLibrary('/System/Library/Frameworks/IOKit.framework/IOKit');
const system=new DynamicLibrary('/usr/lib/libSystem.B.dylib');
const bind=(lib,name,result,args)=>lib.getFunction(name,{return:result,arguments:args});
const get=bind(cg,'CGEventGetIntegerValueField','i64',['pointer','u32']);
const set=bind(cg,'CGEventSetIntegerValueField','void',['pointer','u32','i64']);
const setDouble=bind(cg,'CGEventSetDoubleValueField','void',['pointer','u32','f64']);
const newEvent=bind(cg,'CGEventCreate','pointer',['pointer']);
const setType=bind(cg,'CGEventSetType','void',['pointer','u32']);
const post=bind(cg,'CGEventPost','void',['u32','pointer']);
const release=bind(cf,'CFRelease','void',['pointer']);
const MAGIC=0x5241504f4fn;
function wheelEvent(rawCount,direction=1){
  const delta=lineDelta(rawCount,false,lines),event=newEvent(null);if(!event)throw Error('Cannot create scroll event');
  setType(event,22);set(event,42,MAGIC);set(event,88,0n);
  set(event,11,BigInt(delta*direction));setDouble(event,93,delta*direction);set(event,96,BigInt(delta*direction*10));
  return event;
}
if(selfTest){
  const event=wheelEvent(-2);if(get(event,11)!==-6n||get(event,96)!==-60n||get(event,42)!==MAGIC)throw Error('Native field conversion failed');release(event);
  console.log(JSON.stringify({nativeScrollFieldTest:'passed',eventsPosted:0,eventTapCreated:false}));process.exit(0);
}
const string=bind(cf,'CFStringCreateWithCString','pointer',['pointer','string','u32']);
const number=bind(cf,'CFNumberCreate','pointer',['pointer','i32','pointer']);
const dict=bind(cf,'CFDictionaryCreateMutable','pointer',['pointer','i64','pointer','pointer']);
const put=bind(cf,'CFDictionarySetValue','void',['pointer','pointer','pointer']);
const managerCreate=bind(io,'IOHIDManagerCreate','pointer',['pointer','u32']);
const match=bind(io,'IOHIDManagerSetDeviceMatching','void',['pointer','pointer']);
const valueMatch=bind(io,'IOHIDManagerSetInputValueMatching','void',['pointer','pointer']);
const register=bind(io,'IOHIDManagerRegisterInputValueCallback','void',['pointer','pointer','pointer']);
const schedule=bind(io,'IOHIDManagerScheduleWithRunLoop','void',['pointer','pointer','pointer']);
const open=bind(io,'IOHIDManagerOpen','i32',['pointer','u32']);
const valueElement=bind(io,'IOHIDValueGetElement','pointer',['pointer']);
const usagePage=bind(io,'IOHIDElementGetUsagePage','u32',['pointer']);
const usage=bind(io,'IOHIDElementGetUsage','u32',['pointer']);
const integer=bind(io,'IOHIDValueGetIntegerValue','i64',['pointer']);
const createTap=bind(cg,'CGEventTapCreate','pointer',['u32','u32','u32','u64','pointer','pointer']);
const enable=bind(cg,'CGEventTapEnable','void',['pointer','u8']);
const makeSource=bind(cf,'CFMachPortCreateRunLoopSource','pointer',['pointer','pointer','i64']);
const loop=bind(cf,'CFRunLoopGetCurrent','pointer',[]);
const add=bind(cf,'CFRunLoopAddSource','void',['pointer','pointer','pointer']);
const run=bind(cf,'CFRunLoopRunInMode','i32',['pointer','f64','u8']);
const getParent=bind(system,'getppid','i32',[]),parent=getParent();
function dictionary(entries){
  const d=dict(null,0n,cf.getSymbol('kCFTypeDictionaryKeyCallBacks'),cf.getSymbol('kCFTypeDictionaryValueCallBacks'));
  for(const [name,value]of Object.entries(entries)){const key=string(null,name,0x08000100),b=Buffer.alloc(4);b.writeInt32LE(value);const n=number(null,3,b);put(d,key,n);release(key);release(n);}return d;
}
// Respect the current natural-scroll preference. The raw HID sign precedes this OS inversion.
const preferenceKey=string(null,'com.apple.swipescrolldirection',0x08000100);
const preference=bind(cf,'CFPreferencesCopyValue','pointer',['pointer','pointer','pointer','pointer'])(preferenceKey,
  getUint64(cf.getSymbol('kCFPreferencesAnyApplication')),getUint64(cf.getSymbol('kCFPreferencesCurrentUser')),getUint64(cf.getSymbol('kCFPreferencesAnyHost')));
const natural=preference?Boolean(bind(cf,'CFBooleanGetValue','u8',['pointer'])(preference)):true;
release(preferenceKey);if(preference)release(preference);
const direction=natural?-1:1;
let tap=0n,ready=false;
const rawCallback=io.registerCallback({return:'void',arguments:['pointer','i32','pointer','pointer']},(context,result,sender,value)=>{
  try{
    if(result||!ready||!value)return;const element=valueElement(value);
    if(usagePage(element)!==1||usage(element)!==0x38)return;
    const count=Number(integer(value));if(!Number.isInteger(count)||!count||Math.abs(count)>4096)return;
    const event=wheelEvent(count,direction);post(1,event);release(event);
  }catch{ /* Never unwind through the native callback. */ }
});
const tapCallback=cg.registerCallback({return:'pointer',arguments:['pointer','u32','pointer','pointer']},(proxy,type,event)=>{
  try{
    if(type===0xfffffffe||type===0xffffffff){enable(tap,1);return event;}
    if(!ready||type!==22||!event||get(event,42)===MAGIC||get(event,88)!==0n)return event;
    // Suppress the accelerated vertical component; its raw counts are posted above.
    set(event,11,0n);setDouble(event,93,0);set(event,96,0n);
    return event; // Horizontal axes and other event fields remain unchanged.
  }catch{return event;}
});
if(checkBindings){console.log(JSON.stringify({nativeScrollBindings:'passed',eventsPosted:0,eventTapCreated:false}));process.exit(0);}
tap=createTap(1,0,0,1n<<22n,tapCallback,null);
if(!tap){console.log(JSON.stringify({error:'macOS denied the scroll helper. Allow Terminal / portable Node in System Settings → Privacy & Security → Accessibility, restart it, and try again.'}));process.exit(1);}
const manager=managerCreate(null,0),deviceFilter=dictionary({DeviceUsagePage:1,DeviceUsage:2}),wheelFilter=dictionary({UsagePage:1,Usage:0x38});
match(manager,deviceFilter);valueMatch(manager,wheelFilter);release(deviceFilter);release(wheelFilter);
register(manager,rawCallback,null);
const mode=getUint64(cf.getSymbol('kCFRunLoopDefaultMode')),current=loop();schedule(manager,current,mode);
const result=open(manager,0);
if(result){console.log(JSON.stringify({error:`Cannot read raw wheel counts (0x${(result>>>0).toString(16)}). Allow Terminal / portable Node under macOS Input Monitoring, restart it, and try again.`}));process.exit(1);}
const source=makeSource(null,tap,0n);if(!source)throw Error('Cannot create scroll run loop');add(current,source,mode);enable(tap,1);ready=true;
console.log(JSON.stringify({running:true,lines,scope:'all-hid-mouse-wheels',trackpadUnchanged:true,source:'raw-hid-wheel-counts'}));
while(getParent()===parent)run(mode,0.1,1);

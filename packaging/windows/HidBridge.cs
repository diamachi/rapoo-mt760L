// Windows HID output-report bridge. No input listeners, drivers or exclusive opens.
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;
using Microsoft.Win32.SafeHandles;
class HidBridge {
    [StructLayout(LayoutKind.Sequential)] struct InterfaceData { public int size; public Guid guid; public uint flags; public UIntPtr reserved; }
    [StructLayout(LayoutKind.Sequential)] struct Attributes { public int size; public ushort vendor, product, version; }
    [StructLayout(LayoutKind.Sequential)] struct Caps {
        public ushort usage, usagePage, inputBytes, outputBytes, featureBytes;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst=17)] public ushort[] reserved;
        public ushort linkNodes, inputButtons, inputValues, inputIndices, outputButtons, outputValues, outputIndices, featureButtons, featureValues, featureIndices;
    }
    [DllImport("hid.dll")] static extern void HidD_GetHidGuid(out Guid guid);
    [DllImport("hid.dll")] static extern bool HidD_GetAttributes(SafeFileHandle device, ref Attributes attributes);
    [DllImport("hid.dll")] static extern bool HidD_GetPreparsedData(SafeFileHandle device, out IntPtr data);
    [DllImport("hid.dll")] static extern bool HidD_FreePreparsedData(IntPtr data);
    [DllImport("hid.dll")] static extern int HidP_GetCaps(IntPtr data, out Caps caps);
    [DllImport("hid.dll")] static extern int HidP_GetValueCaps(int type, IntPtr caps, ref ushort length, IntPtr data);
    [DllImport("hid.dll", SetLastError=true)] static extern bool HidD_SetOutputReport(SafeFileHandle device, byte[] report, int length);
    [DllImport("hid.dll", SetLastError=true)] static extern bool HidD_GetInputReport(SafeFileHandle device, byte[] report, int length);
    [DllImport("setupapi.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr SetupDiGetClassDevs(ref Guid guid, IntPtr enumerator, IntPtr parent, uint flags);
    [DllImport("setupapi.dll", SetLastError=true)] static extern bool SetupDiEnumDeviceInterfaces(IntPtr set, IntPtr device, ref Guid guid, uint index, ref InterfaceData data);
    [DllImport("setupapi.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool SetupDiGetDeviceInterfaceDetail(IntPtr set, ref InterfaceData data, IntPtr detail, uint length, out uint required, IntPtr device);
    [DllImport("setupapi.dll")] static extern bool SetupDiDestroyDeviceInfoList(IntPtr set);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern SafeFileHandle CreateFile(string path, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);
    class Device {
        public string path, id;
        public bool compatible;
        public ushort outputBytes;
        public object Public() { return new {id, compatible, vendorId=0x24ae, productId=0x1870, productName="Rapoo MT760L receiver", outputReportBytes=outputBytes, reportId=0xba}; }
    }
    static string Id(string path) { using(var sha=SHA256.Create()) return BitConverter.ToUInt64(sha.ComputeHash(Encoding.UTF8.GetBytes(path.ToLowerInvariant())),0).ToString(CultureInfo.InvariantCulture); }
    static bool HasReportBA(IntPtr parsed, Caps caps) {
        if(caps.outputBytes!=32 || caps.outputValues==0)return false;
        ushort count=caps.outputValues; IntPtr values=Marshal.AllocHGlobal(72*count);
        try {
            if(HidP_GetValueCaps(1,values,ref count,parsed)!=0x00110000)return false;
            int bits=0;
            for(int i=0;i<count;i++) { IntPtr item=IntPtr.Add(values,72*i); if(Marshal.ReadByte(item,2)==0xba)bits+=(ushort)Marshal.ReadInt16(item,18)*(ushort)Marshal.ReadInt16(item,20); }
            return bits==248;
        } finally { Marshal.FreeHGlobal(values); }
    }
    static List<Device> Devices() {
        var result=new List<Device>();Guid guid;HidD_GetHidGuid(out guid);
        IntPtr set=SetupDiGetClassDevs(ref guid,IntPtr.Zero,IntPtr.Zero,0x12);
        if(set==new IntPtr(-1))throw new Win32Exception(Marshal.GetLastWin32Error());
        try {
            for(uint index=0;;index++) {
                var data=new InterfaceData {size=Marshal.SizeOf(typeof(InterfaceData))};
                if(!SetupDiEnumDeviceInterfaces(set,IntPtr.Zero,ref guid,index,ref data)) {
                    int error=Marshal.GetLastWin32Error();if(error==259)break;throw new Win32Exception(error);
                }
                uint needed;SetupDiGetDeviceInterfaceDetail(set,ref data,IntPtr.Zero,0,out needed,IntPtr.Zero);
                if(needed<8 || needed>65536)continue;
                IntPtr detail=Marshal.AllocHGlobal((int)needed);
                try {
                    Marshal.WriteInt32(detail,IntPtr.Size==8?8:6);
                    if(!SetupDiGetDeviceInterfaceDetail(set,ref data,detail,needed,out needed,IntPtr.Zero))continue;
                    string path=Marshal.PtrToStringUni(IntPtr.Add(detail,4));
                    if(path==null || path.IndexOf("vid_24ae&pid_1870",StringComparison.OrdinalIgnoreCase)<0)continue;
                    using(var handle=CreateFile(path,0,3,IntPtr.Zero,3,0,IntPtr.Zero)) {
                        if(handle.IsInvalid)continue;
                        var attributes=new Attributes {size=Marshal.SizeOf(typeof(Attributes))};
                        if(!HidD_GetAttributes(handle,ref attributes) || attributes.vendor!=0x24ae || attributes.product!=0x1870)continue;
                        IntPtr parsed;if(!HidD_GetPreparsedData(handle,out parsed))continue;
                        try {Caps caps;if(HidP_GetCaps(parsed,out caps)!=0x00110000)continue;result.Add(new Device {path=path,id=Id(path),compatible=HasReportBA(parsed,caps),outputBytes=caps.outputBytes});}
                        finally {HidD_FreePreparsedData(parsed);}
                    }
                } finally {Marshal.FreeHGlobal(detail);}
            }
        } finally {SetupDiDestroyDeviceInfoList(set);}
        return result;
    }
    static byte[] Report(string hex) {
        if(hex.Length!=64)throw new Exception("Expected 32 report bytes");
        var bytes=new byte[32];for(int i=0;i<32;i++)bytes[i]=byte.Parse(hex.Substring(i*2,2),NumberStyles.HexNumber,CultureInfo.InvariantCulture);
        if(bytes[0]!=0xba || bytes[1]!=0xa5 || bytes[2]!=0xa5)throw new Exception("Unsupported configuration report");
        uint address=BitConverter.ToUInt32(bytes,4);
        if(!(address==0x638 || address==0x630 || address==0x648 || (address>=0x600 && address<=0x628 && (address-0x600)%4==0)))throw new Exception("Unsupported parameter address");
        return bytes;
    }
    static int Main(string[] args) {
        var json=new JavaScriptSerializer();
        try {
            if(args.Length==1 && args[0]=="--self-test") {
                if(Marshal.SizeOf(typeof(Caps))!=64 || Marshal.SizeOf(typeof(InterfaceData))!=32)throw new Exception("Unexpected x64 HID structure layout");
                Console.WriteLine(json.Serialize(new {nativeWindowsSelfTest="passed",reportsSent=0}));return 0;
            }
            if(args.Length<1)throw new Exception("Expected list, probe or send");
            var devices=Devices();
            if(args[0]=="list") {Console.WriteLine(json.Serialize(new {devices=devices.ConvertAll(d=>d.Public())}));return 0;}
            if(args.Length<2 || (args[0]!="probe" && args[0]!="send" && args[0]!="battery"))throw new Exception("Unsupported operation");
            var device=devices.Find(d=>d.id==args[1] && d.compatible);if(device==null)throw new Exception("Compatible receiver not found. Reconnect the 2.4 GHz receiver.");
            using(var handle=CreateFile(device.path,args[0]=="battery"?0xc0000000:0x40000000,3,IntPtr.Zero,3,0,IntPtr.Zero)) {
                if(handle.IsInvalid)throw new Exception("Windows denied receiver access: "+new Win32Exception(Marshal.GetLastWin32Error()).Message);
                if(args[0]=="send") {
                    if(args.Length!=3)throw new Exception("Expected report bytes");
                    var bytes=Report(args[2]);if(!HidD_SetOutputReport(handle,bytes,bytes.Length))throw new Exception("Receiver output report failed: "+new Win32Exception(Marshal.GetLastWin32Error()).Message);
                }
                if(args[0]=="battery") {
                    var request=new byte[32];request[0]=0xba;request[1]=0xa5;request[2]=0xaa;
                    var reply=new byte[32];
                    for(int attempt=0;attempt<3;attempt++) {
                        if(!HidD_SetOutputReport(handle,request,32))throw new Exception("Battery status request failed");
                        System.Threading.Thread.Sleep(50);Array.Clear(reply,0,reply.Length);reply[0]=0xba;
                        if(!HidD_GetInputReport(handle,reply,32))throw new Exception("Battery status read failed");
                        if(reply[0]==1)break;
                    }
                    if(reply[0]!=1)throw new Exception("Mouse battery response timed out. Wake the mouse and refresh.");
                    Console.WriteLine(json.Serialize(new {batteryReport=BitConverter.ToString(reply).Replace("-","").ToLowerInvariant()}));return 0;
                }
            }
            Console.WriteLine(json.Serialize(new {device=device.Public(),status=args[0]=="send"?"sent-unverified":"opened"}));return 0;
        } catch(Exception error) {Console.WriteLine(json.Serialize(new {error=error.Message}));return 1;}
    }
}

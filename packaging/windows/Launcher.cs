using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
class DesktopWindow : Form {
    Process server;
    WebView2 web;
    bool closing;
    readonly bool smoke;
    bool darkTheme=true;
    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr hwnd,int attribute,ref int value,int size);
    static int ColorRef(Color color) {return color.R | (color.G<<8) | (color.B<<16);}
    void ApplyAppearance(bool dark) {
        darkTheme=dark;
        BackColor=dark?Color.FromArgb(46,52,64):Color.FromArgb(244,245,239);
        if(web!=null)web.DefaultBackgroundColor=BackColor;
        if(!IsHandleCreated)return;
        try {
            int mode=dark?1:0,caption=ColorRef(BackColor),text=ColorRef(dark?Color.FromArgb(236,239,244):Color.FromArgb(24,49,40));
            DwmSetWindowAttribute(Handle,20,ref mode,4);
            // Exact caption/text colors are supported on Windows 11; older systems keep their native fallback.
            DwmSetWindowAttribute(Handle,35,ref caption,4);
            DwmSetWindowAttribute(Handle,36,ref text,4);
        } catch(DllNotFoundException) {} catch(EntryPointNotFoundException) {}
    }
    protected override void OnHandleCreated(EventArgs e) {base.OnHandleCreated(e);ApplyAppearance(darkTheme);}

    protected override void OnLoad(EventArgs e) {
        base.OnLoad(e);
        var area=Screen.FromControl(this).WorkingArea;
        MinimumSize=new Size(Math.Min(MinimumSize.Width,area.Width),Math.Min(MinimumSize.Height,area.Height));
        Size=new Size(Math.Min(Width,area.Width),Math.Min(Height,area.Height));
        Location=new Point(area.Left+(area.Width-Width)/2,area.Top+(area.Height-Height)/2);
    }
    const string Home="http://127.0.0.1:8765/";
    readonly string root=AppDomain.CurrentDomain.BaseDirectory;
    public DesktopWindow(bool smokeTest) {
        AutoScaleDimensions=new SizeF(96,96);AutoScaleMode=System.Windows.Forms.AutoScaleMode.Dpi;
        smoke=smokeTest;Text="OpenRapoo";Width=1200;Height=820;MinimumSize=new Size(760,600);StartPosition=FormStartPosition.CenterScreen;
        BackColor=Color.FromArgb(46,52,64);
        Icon=System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Shown+=async (s,e)=>await StartApp();
        FormClosed+=(s,e)=>StopServer();
    }
    async Task StartApp() {
        try {
            string profile=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"OpenRapoo","WebView2");
            var env=await CoreWebView2Environment.CreateAsync(null,profile);
            web=new WebView2 {Dock=DockStyle.Fill,DefaultBackgroundColor=BackColor};Controls.Add(web);
            await web.EnsureCoreWebView2Async(env);
            web.CoreWebView2.WebMessageReceived+=(s,e)=>{
                Uri source;
                if(!Uri.TryCreate(e.Source,UriKind.Absolute,out source) || source.Scheme!="http" || source.Host!="127.0.0.1" || source.Port!=8765)return;
                try {
                    var message=new JavaScriptSerializer().DeserializeObject(e.WebMessageAsJson) as System.Collections.Generic.Dictionary<string,object>;
                    object type,theme;
                    if(message!=null && message.TryGetValue("type",out type) && (type as string)=="appearance" && message.TryGetValue("theme",out theme) && ((theme as string)=="dark" || (theme as string)=="light"))ApplyAppearance((string)theme=="dark");
                } catch(ArgumentException) {} catch(InvalidOperationException) {}
            };
            web.CoreWebView2.Settings.AreDefaultContextMenusEnabled=false;
            web.CoreWebView2.Settings.AreDevToolsEnabled=false;
            web.CoreWebView2.NewWindowRequested+=(s,e)=>{e.Handled=true;};
            web.CoreWebView2.NavigationStarting+=(s,e)=>{
                Uri uri;if(!Uri.TryCreate(e.Uri,UriKind.Absolute,out uri) || uri.Scheme!="http" || uri.Host!="127.0.0.1" || uri.Port!=8765)e.Cancel=true;
            };
            web.CoreWebView2.NavigationCompleted+=async (s,e)=>{
                if(smoke && e.IsSuccess) {
                    for(int i=0;i<60;i++) {
                        string result=await web.CoreWebView2.ExecuteScriptAsync("document.querySelectorAll('.dpi-stage').length === 6 && document.querySelectorAll('.polling-rate').length === 4 && !document.getElementById('scroll') && document.documentElement.dataset.theme === '" + (darkTheme?"dark":"light") + "'");
                        if(result=="true"){Environment.ExitCode=0;Close();return;}await Task.Delay(200);
                    }
                    Environment.ExitCode=1;Close();
                }
            };
            var start=new ProcessStartInfo(Path.Combine(root,"_toolchain","portable-node-windows-x64","node.exe"),"\""+Path.Combine(root,"scripts","desktop-server.mjs")+"\"");
            start.WorkingDirectory=root;start.UseShellExecute=false;start.CreateNoWindow=true;start.WindowStyle=ProcessWindowStyle.Hidden;
            start.EnvironmentVariables["RAPOO_PORT"]="8765";start.EnvironmentVariables["RAPOO_PARENT_PID"]=Process.GetCurrentProcess().Id.ToString();
            server=Process.Start(start);
            var metadata=new JavaScriptSerializer().DeserializeObject(File.ReadAllText(Path.Combine(root,"app","package.json"))) as System.Collections.Generic.Dictionary<string,object>;
            using(var client=new HttpClient()) {
                client.Timeout=TimeSpan.FromSeconds(1);
                for(int i=0;i<75;i++) {
                    if(server.HasExited)throw new Exception("App service stopped. Close other OpenRapoo instances and try again.");
                    try {
                        var info=new JavaScriptSerializer().DeserializeObject(await client.GetStringAsync(Home+"api/info")) as System.Collections.Generic.Dictionary<string,object>;
                        if(info!=null && (string)info["app"]=="openrapoo" && (string)info["version"]==(string)metadata["version"]){web.CoreWebView2.Navigate(Home);return;}
                    } catch(HttpRequestException) {} catch(TaskCanceledException) {}
                    await Task.Delay(200);
                }
            }
            throw new Exception("The local app service did not become ready.");
        } catch(Exception error) {
            Environment.ExitCode=1;
            if(!smoke)MessageBox.Show(this,error.Message+"\n\nReinstall using the OpenRapoo setup package if the WebView2 runtime is missing.","OpenRapoo",MessageBoxButtons.OK,MessageBoxIcon.Error);
            Close();
        }
    }
    void StopServer() {if(closing)return;closing=true;try{if(server!=null && !server.HasExited){server.Kill();server.WaitForExit(3000);}}catch{}if(server!=null)server.Dispose();}
}
class Launcher {
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("shcore.dll")] static extern int SetProcessDpiAwareness(int awareness);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    static void EnableDisplayScaling() {
        try {if(SetProcessDpiAwarenessContext(new IntPtr(-4)))return;}catch(EntryPointNotFoundException) {}
        try {if(SetProcessDpiAwareness(2)==0)return;}catch(DllNotFoundException) {}catch(EntryPointNotFoundException) {}
        SetProcessDPIAware();
    }
    [DllImport("shell32.dll",CharSet=CharSet.Unicode)] static extern int SetCurrentProcessExplicitAppUserModelID(string appID);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr FindWindow(string cls,string name);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr handle);
    [STAThread] static int Main(string[] args) {
        EnableDisplayScaling();
        SetCurrentProcessExplicitAppUserModelID("OpenRapoo.Desktop");
        if(args.Length==1 && args[0]=="--self-test")return File.Exists(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"app","native","windows-hid.exe"))?0:1;
        bool first;using(var mutex=new Mutex(true,"Local\\OpenRapooDesktop",out first)) {
            if(!first){SetForegroundWindow(FindWindow(null,"OpenRapoo"));return 0;}
            Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
            Application.ThreadException+=(s,e)=>{Environment.ExitCode=1;Application.Exit();};
            Application.Run(new DesktopWindow(args.Length==1 && args[0]=="--smoke-test"));
            return Environment.ExitCode;
        }
    }
}

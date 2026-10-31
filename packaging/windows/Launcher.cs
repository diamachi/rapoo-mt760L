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
    const string Home="http://127.0.0.1:8765/";
    readonly string root=AppDomain.CurrentDomain.BaseDirectory;
    public DesktopWindow(bool smokeTest) {
        smoke=smokeTest;Text="Rapoo Local";Width=1200;Height=820;MinimumSize=new Size(760,600);StartPosition=FormStartPosition.CenterScreen;
        BackColor=Color.FromArgb(46,52,64);
        Icon=System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Shown+=async (s,e)=>await StartApp();
        FormClosed+=(s,e)=>StopServer();
    }
    async Task StartApp() {
        try {
            string profile=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Rapoo Local","WebView2");
            var env=await CoreWebView2Environment.CreateAsync(null,profile);
            web=new WebView2 {Dock=DockStyle.Fill,DefaultBackgroundColor=BackColor};Controls.Add(web);
            await web.EnsureCoreWebView2Async(env);
            web.CoreWebView2.Settings.AreDefaultContextMenusEnabled=false;
            web.CoreWebView2.Settings.AreDevToolsEnabled=false;
            web.CoreWebView2.NewWindowRequested+=(s,e)=>{e.Handled=true;};
            web.CoreWebView2.NavigationStarting+=(s,e)=>{
                Uri uri;if(!Uri.TryCreate(e.Uri,UriKind.Absolute,out uri) || uri.Scheme!="http" || uri.Host!="127.0.0.1" || uri.Port!=8765)e.Cancel=true;
            };
            web.CoreWebView2.NavigationCompleted+=async (s,e)=>{
                if(smoke && e.IsSuccess) {
                    for(int i=0;i<60;i++) {
                        string result=await web.CoreWebView2.ExecuteScriptAsync("document.querySelectorAll('.dpi-stage').length === 6 && document.querySelectorAll('.polling-rate').length === 4 && !document.getElementById('scroll')");
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
                    if(server.HasExited)throw new Exception("App service stopped. Close other Rapoo Local instances and try again.");
                    try {
                        var info=new JavaScriptSerializer().DeserializeObject(await client.GetStringAsync(Home+"api/info")) as System.Collections.Generic.Dictionary<string,object>;
                        if(info!=null && (string)info["app"]=="rapoo-local" && (string)info["version"]==(string)metadata["version"]){web.CoreWebView2.Navigate(Home);return;}
                    } catch(HttpRequestException) {} catch(TaskCanceledException) {}
                    await Task.Delay(200);
                }
            }
            throw new Exception("The local app service did not become ready.");
        } catch(Exception error) {
            Environment.ExitCode=1;
            if(!smoke)MessageBox.Show(this,error.Message+"\n\nReinstall using the Rapoo Local setup package if the WebView2 runtime is missing.","Rapoo Local",MessageBoxButtons.OK,MessageBoxIcon.Error);
            Close();
        }
    }
    void StopServer() {if(closing)return;closing=true;try{if(server!=null && !server.HasExited){server.Kill();server.WaitForExit(3000);}}catch{}if(server!=null)server.Dispose();}
}
class Launcher {
    [DllImport("shell32.dll",CharSet=CharSet.Unicode)] static extern int SetCurrentProcessExplicitAppUserModelID(string appID);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr FindWindow(string cls,string name);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr handle);
    [STAThread] static int Main(string[] args) {
        SetCurrentProcessExplicitAppUserModelID("RapooLocal.Desktop");
        if(args.Length==1 && args[0]=="--self-test")return File.Exists(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"app","native","windows-hid.exe"))?0:1;
        bool first;using(var mutex=new Mutex(true,"Local\\RapooLocalDesktop",out first)) {
            if(!first){SetForegroundWindow(FindWindow(null,"Rapoo Local"));return 0;}
            Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
            Application.ThreadException+=(s,e)=>{Environment.ExitCode=1;Application.Exit();};
            Application.Run(new DesktopWindow(args.Length==1 && args[0]=="--smoke-test"));
            return Environment.ExitCode;
        }
    }
}

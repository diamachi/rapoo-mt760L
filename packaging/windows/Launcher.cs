// Compiled on Windows by build-launcher.ps1, using the existing .NET Framework compiler.
using System;
using System.Diagnostics;
using System.IO;
class Launcher {
    static int Main(string[] args) {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string runtime = Path.Combine(root, "_toolchain", "node26", "node.exe");
        if (!File.Exists(runtime)) { Console.Error.WriteLine("Missing bundled Node runtime. Extract the entire ZIP first."); return 1; }
        if (args.Length == 1 && args[0] == "--self-test") { Console.WriteLine("Rapoo Local launcher OK"); return 0; }
        try {
            var info = new ProcessStartInfo(runtime, "\"" + Path.Combine(root, "scripts", "launch-app.mjs") + "\"");
            info.WorkingDirectory = root;
            info.UseShellExecute = false;
            using (var child = Process.Start(info)) { child.WaitForExit(); return child.ExitCode; }
        } catch (Exception e) { Console.Error.WriteLine(e.Message); return 1; }
    }
}

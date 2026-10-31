param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path $compiler)) { throw 'Existing .NET Framework compiler not found.' }
$version = '1.0.4314.35'
$cache = Join-Path $PSScriptRoot "../../_toolchain/webview2-sdk-$version"
if (!(Test-Path "$cache/lib")) {
  New-Item -ItemType Directory -Path $cache -Force | Out-Null
  Invoke-WebRequest "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$version/microsoft.web.webview2.$version.nupkg" -OutFile "$cache/SDK.zip"
  Expand-Archive -LiteralPath "$cache/SDK.zip" -DestinationPath $cache -Force
}
$forms = Get-ChildItem "$cache/lib" -Recurse -Filter 'Microsoft.Web.WebView2.WinForms.dll' | Where-Object { $_.FullName -match '\\net462\\|\\net45\\' } | Select-Object -First 1
if (!$forms) { throw 'WebView2 .NET Framework assemblies not found' }
$core = Join-Path $forms.DirectoryName 'Microsoft.Web.WebView2.Core.dll'
foreach ($file in @($forms.FullName, $core, "$cache/runtimes/win-x64/native/WebView2Loader.dll")) { Copy-Item $file $OutputDirectory -Force }
$licenses = Get-ChildItem $cache -Recurse -File | Where-Object {$_.Name -match '^(LICENSE|License)(\.txt)?$'}
if (!$licenses) { throw 'WebView2 SDK license not found' }
Copy-Item $licenses[0].FullName (Join-Path $OutputDirectory 'WebView2-LICENSE.txt') -Force
# Runtime packages omit Mac source, so create the native helper destination explicitly.
New-Item -ItemType Directory -Path (Join-Path $OutputDirectory 'app/native') -Force | Out-Null
& $compiler /nologo /target:exe /platform:x64 /reference:System.Web.Extensions.dll "/out:$OutputDirectory/app/native/windows-hid.exe" (Join-Path $PSScriptRoot 'HidBridge.cs')
if ($LASTEXITCODE -ne 0) { throw 'Native HID bridge compilation failed' }
& $compiler /nologo /target:winexe /platform:x64 "/win32icon:$PSScriptRoot/../assets/app-icon.ico" /reference:System.Drawing.dll /reference:System.Windows.Forms.dll /reference:System.Net.Http.dll /reference:System.Web.Extensions.dll "/reference:$($forms.FullName)" "/reference:$core" "/out:$OutputDirectory/OpenRapoo.exe" (Join-Path $PSScriptRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Desktop launcher compilation failed' }
& "$OutputDirectory/app/native/windows-hid.exe" --self-test
if ($LASTEXITCODE -ne 0) { throw 'Native Windows structure self-test failed' }
& "$OutputDirectory/app/native/windows-hid.exe" list
if ($LASTEXITCODE -ne 0) { throw 'Native Windows enumeration check failed' }
$launcher = Start-Process -FilePath "$OutputDirectory/OpenRapoo.exe" -ArgumentList '--self-test' -Wait -PassThru
if ($launcher.ExitCode -ne 0) { throw 'Desktop launcher self-test failed' }
$bootstrap = Join-Path $cache 'MicrosoftEdgeWebview2Setup.exe'
if (!(Test-Path $bootstrap)) { Invoke-WebRequest 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile $bootstrap }
$signature = Get-AuthenticodeSignature $bootstrap
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft Corporation') { throw 'WebView2 installer signature verification failed' }

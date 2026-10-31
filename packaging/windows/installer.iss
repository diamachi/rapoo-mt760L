#ifndef AppVersion
#define AppVersion "0.4.0"
#endif
[Setup]
AppId={{7055C9A1-591C-4AF2-9B3B-44A0BEF23C72}
AppName=OpenRapoo
AppVersion={#AppVersion}
AppPublisher=OpenRapoo contributors
SetupIconFile=..\assets\app-icon.ico
DefaultDirName={localappdata}\Programs\OpenRapoo
DefaultGroupName=OpenRapoo
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#OutputDirectory}
OutputBaseFilename=OpenRapoo-{#AppVersion}-windows-x64-setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\OpenRapoo.exe
CloseApplications=yes
[Files]
Source: "{#AppDirectory}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#Bootstrapper}"; Flags: dontcopy
[Icons]
Name: "{group}\OpenRapoo"; Filename: "{app}\OpenRapoo.exe"; AppUserModelID: "OpenRapoo.Desktop"; IconFilename: "{app}\OpenRapoo.exe"
Name: "{autodesktop}\OpenRapoo"; Filename: "{app}\OpenRapoo.exe"; Tasks: desktopicon; AppUserModelID: "OpenRapoo.Desktop"; IconFilename: "{app}\OpenRapoo.exe"
[Tasks]
Name: desktopicon; Description: "Create a desktop shortcut"; Flags: unchecked
[Run]
Filename: "{app}\OpenRapoo.exe"; Description: "Open OpenRapoo"; Flags: nowait postinstall skipifsilent
[Code]
function HasWebView2: Boolean;
var Version: String;
begin
  Result := (RegQueryStringValue(HKLM32, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0')) or
    (RegQueryStringValue(HKCU, 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0'));
end;
function PrepareToInstall(var NeedsRestart: Boolean): String;
var Code: Integer;
begin
  Result := '';
  if not HasWebView2 then begin
    ExtractTemporaryFile('MicrosoftEdgeWebview2Setup.exe');
    if not Exec(ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe'), '/silent /install', '', SW_HIDE, ewWaitUntilTerminated, Code) then
      Result := 'Could not start Microsoft WebView2 setup. Connect to the internet and try again.'
    else if not HasWebView2 then
      Result := 'Microsoft WebView2 setup did not complete. Check your internet connection and retry installation.';
  end;
end;

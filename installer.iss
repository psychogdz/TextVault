; TextVault — Inno Setup installer script.
; Version is passed in by test/make-release.cjs via /DMyAppVersion=<package.json version>
; so package.json stays the single source of truth.

#ifndef MyAppVersion
#error "Compile with /DMyAppVersion=<version>"
#endif

#define MyAppName "TextVault"
#define MyAppPublisher "TextVault"
#define MyAppExeName "TextVault.exe"
#define MyAppVersionTag MyAppVersion

[Setup]
AppId={{7E9F6C2A-4B8E-4C7D-9A15-3F2E8D61B4C7}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
; per-user install: no administrator rights required
PrivilegesRequired=lowest
DefaultDirName={autopf}\{#MyAppName}
DisableProgramGroupPage=yes
; user can still change the directory in the wizard
EnableDirDoesntExistWarning=yes
OutputDir=release
OutputBaseFilename=TextVault-{#MyAppVersion}-Setup
SetupIconFile=src\assets\icons\textvault.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
CloseApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Files]
Source: "release\TextVault-{#MyAppVersionTag}-Portable\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent

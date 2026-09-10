; ============================================================================
;  Inno Setup 6 — Bo cai Setup.exe cho CSDL Vat chat Doanh trai Tinh (offline)
;  Bien dich: mo tep nay bang Inno Setup Compiler (tren Windows) roi Build (Ctrl+F9).
;  Yeu cau: da chay 'bash prepare-offline.sh' de tao thu muc dist\ (ben canh tep nay).
; ============================================================================

#define AppName "CSDL Vat chat Doanh trai Tinh"
#define AppVersion "1.0.0"
#define Publisher "Bo CHQS Tinh"
#define AppDirName "CSDL-DoanhTrai"

[Setup]
AppId={{7F3C2A10-4B8E-4E2A-9C11-CSDLDOANHTRAI01}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#Publisher}
DefaultDirName={autopf}\{#AppDirName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputBaseFilename=CSDL-DoanhTrai-Setup
Compression=lzma2/max
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
WizardStyle=modern
UninstallDisplayName={#AppName}
; Bo cai chua image offline nhieu GB — cho phep khong gian lon.
DiskSpanning=no

[Languages]
Name: "vi"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Tao bieu tuong ngoai Desktop"; GroupDescription: "Bieu tuong:"

[Files]
; Toan bo noi dung thu muc dist\ (script + compose + images\*.tar + data\ + tiles\)
Source: "dist\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\Khoi dong CSDL Doanh trai"; Filename: "{app}\start.bat"; WorkingDir: "{app}"
Name: "{group}\Dung CSDL Doanh trai";      Filename: "{app}\stop.bat";  WorkingDir: "{app}"
Name: "{group}\Nap lai du lieu mau";        Filename: "{app}\seed-demo.bat"; WorkingDir: "{app}"
Name: "{group}\Huong dan (README)";         Filename: "{app}\README-WINDOWS.md"
Name: "{group}\Go cai dat";                 Filename: "{uninstallexe}"
Name: "{autodesktop}\CSDL Doanh trai";      Filename: "{app}\start.bat"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; Sau khi chep xong: (tuy chon) trien khai ngay — nap image + dung stack + seed.
Filename: "{app}\install.bat"; Description: "Trien khai ngay (nap image, khoi dong, nap du lieu mau)"; \
  WorkingDir: "{app}"; Flags: postinstall shellexec skipifsilent

[UninstallRun]
; Khi go cai dat: dung va xoa container + volume (khong hoi).
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\uninstall.ps1"" -Silent"; \
  WorkingDir: "{app}"; Flags: runhidden; RunOnceId: "CsdlComposeDown"

' TextVault desktop launcher.
' Double-click this file to start TextVault with NO visible console window.
' The app runs as an independent process — closing/killing this script (or any
' terminal) never terminates TextVault.
'
' First run: if dependencies are missing, it installs them silently (this can
' take a couple of minutes), then launches the app.

Option Explicit

Dim fso, shell, root, exe, installed
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

root = fso.GetParentFolderName(WScript.ScriptFullName)
exe = root & "\node_modules\electron\dist\electron.exe"

' Prefer the packaged portable app if present (no Node needed at all).
If fso.FileExists(root & "\release\TextVault-1.0.0-Portable\TextVault.exe") Then
  shell.CurrentDirectory = root & "\release\TextVault-1.0.0-Portable"
  shell.Run """" & root & "\release\TextVault-1.0.0-Portable\TextVault.exe""", 1, False
  WScript.Quit 0
End If
If fso.FileExists(root & "\dist\TextVault\TextVault.exe") Then
  shell.CurrentDirectory = root & "\dist\TextVault"
  shell.Run """" & root & "\dist\TextVault\TextVault.exe""", 1, False
  WScript.Quit 0
End If

' Dev mode: make sure dependencies exist (install hidden if missing).
If Not fso.FileExists(exe) Then
  If Not fso.FileExists(root & "\tools\node\npm.cmd") And Not HasGlobalNpm() Then
    MsgBox "TextVault needs its bundled Node.js (tools\node) or a global Node.js install." & vbCrLf & _
           "Please re-extract the full project folder and try again.", vbCritical, "TextVault"
    WScript.Quit 1
  End If
  shell.CurrentDirectory = root
  If fso.FileExists(root & "\tools\node\npm.cmd") Then
    shell.Run "cmd /c cd /d """ & root & """ && tools\node\npm.cmd install --no-audit --no-fund", 0, True
  Else
    shell.Run "cmd /c cd /d """ & root & """ && npm install --no-audit --no-fund", 0, True
  End If
End If

If fso.FileExists(exe) Then
  shell.CurrentDirectory = root
  ' Launch the Electron binary directly (GUI process, detached, no console).
  shell.Run """" & exe & """ .", 1, False
Else
  MsgBox "Setup did not complete — electron.exe was not found after installation." & vbCrLf & _
         "Run start.bat in a terminal to see the error.", vbCritical, "TextVault"
End If

Function HasGlobalNpm()
  On Error Resume Next
  Dim fc
  Set fc = shell.Exec("cmd /c where npm")
  HasGlobalNpm = (InStr(fc.StdOut.ReadAll(), "npm.cmd") > 0)
  If Err.Number <> 0 Then HasGlobalNpm = False
  On Error GoTo 0
End Function

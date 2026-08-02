' Silent variant used by the logon auto-start: brings the dashboard server
' (and, if the job wasn't finished, the generation job itself, via the
' server's own auto-resume check) back up with no visible window and no
' browser tab. View progress any time via the taskbar shortcut
' (OpenPuzzleDashboard.vbs) or http://localhost:4321.
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

strScriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
strRoot = objFSO.GetParentFolderName(strScriptDir)
objShell.CurrentDirectory = strRoot

objShell.Run "cmd /c npx tsx scripts\dashboardServer.ts >> scripts\.genraw.log 2>&1", 0, False

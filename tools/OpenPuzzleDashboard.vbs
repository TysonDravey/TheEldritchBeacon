' Launches the puzzle generation dashboard with no visible console window,
' then opens it in the default browser. This is what the taskbar shortcut
' points at.
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

strScriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
strRoot = objFSO.GetParentFolderName(strScriptDir)
objShell.CurrentDirectory = strRoot

' 0 = fully hidden window, False = don't wait for it to exit
objShell.Run "cmd /c npx tsx scripts\dashboardServer.ts >> scripts\.genraw.log 2>&1", 0, False

WScript.Sleep 2000
objShell.Run "http://localhost:4321", 1, False

' Lanca o start-windows.ps1 totalmente escondido (nenhuma janela aparece).
' Existe porque "-WindowStyle Hidden" do PowerShell nao garante janela
' escondida no Windows 11 quando o Windows Terminal e o terminal padrao -
' WScript.Shell.Run com o modo 0 e a forma robusta de evitar isso.
'
' Uso no atalho (Area de Trabalho ou pasta Inicializar): aponte o atalho
' direto para este arquivo .vbs, sem precisar digitar nenhum comando.

Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & scriptDir & "\start-windows.ps1"""

Set shell = CreateObject("WScript.Shell")
shell.Run command, 0, False

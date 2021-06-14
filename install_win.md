# WSL2 setup
Create `projects` in Win User dir, then `ln -s /mnt/c/Users/ice/projects ~/projects` from wsl2.
Git clone this repo in `~/projects`

``` cmd
mklink /h "C:\Users\ice\AppData\Roaming\Code - Insiders\User\keybindings.json" "C:\Users\ice\projects\dotfiles\vscode\keybindings.json" 
mklink /h "C:\Users\ice\AppData\Roaming\Code - Insiders\User\settings.json" "C:\Users\ice\projects\dotfiles\vscode\settings.json" 
```

``` bash
cat ~/projects/dotfiles/vscode/extensions.txt | xargs -n 1 code-insiders --install-extension
```

# Install packages using winget
``` powershell
winget install Microsoft.WindowsTerminal
winget install Microsoft.VisualStudioCodeInsiders.User-x64
winget install Microsoft.AzureDataStudio
winget install Mozilla.Firefox
winget install Google.Chrome --force
winget install BraveSoftware.BraveBrowser
winget install OBSProject.OBSStudio
winget install Git.Git
winget install SlackTechnologies.Slack
winget install WinDirStat.WinDirStat
winget install SumatraPDF.SumatraPDF
winget install Python.Python
winget install Microsoft.dotnet
winget install TeamViewer.TeamViewer --force
winget install Zotero.Zotero
winget install LibreOffice.LibreOffice
winget install Valve.Steam
winget install ElectronicArts.EADesktop
winget install Oracle.VirtualBox
winget install VMware.WorkstationPlayer
```

# Install packages using choco

### Launch Admin PowerShell
Install Chocolatey
``` powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
```

``` powershell
choco install -y mpv

# R statistics
choco install -y r.project
choco install -y r.studio

choco install -y miktex
```
# Debloat Windows 10 in 2021
see [christitus.com](https://christitus.com/debloat-windows-10-2020/#january-2021-update)

``` powershell
iex ((New-Object System.Net.WebClient).DownloadString('https://git.io/JJ8R4'))

```


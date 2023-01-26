# WSL2 setup
Create `projects` in Win User dir, then `ln -s /mnt/c/Users/ice/projects ~/projects` from wsl2.
Git clone this repo in `~/projects`

``` cmd
mklink /h "C:\Users\ice\.ideavimrc" "C:\Users\ice\projects\dotfiles\.ideavimrc" 
``` 

``` cmd
mkdir "C:\Users\ice\AppData\Roaming\VSCodium\User"
del "C:\Users\ice\AppData\Roaming\VSCodium\User\settings.json"
del "C:\Users\ice\AppData\Roaming\VSCodium\User\keybindings.json"
mklink /h "C:\Users\ice\AppData\Roaming\VSCodium\User\keybindings.json" "C:\Users\ice\projects\dotfiles\configs\vscode\.config\Code\User\keybindings.json"
mklink /h "C:\Users\ice\AppData\Roaming\VSCodium\User\settings.json" "C:\Users\ice\projects\dotfiles\configs\vscode\.config\Code\User\settings.json"

codium  --list-extensions --show-versions 

codium --install-extension asvetliakov.vscode-neovim
codium --install-extension VSpaceCode.whichkey
codium --install-extension jdinhlife.gruvbox
codium  --install-extension eamodio.gitlens
```

[Meslo Nerd fonts](https://github.com/romkatv/dotfiles-public/tree/master/.local/share/fonts/NerdFonts)

``` bash
cat ~/projects/dotfiles/vscode/extensions.txt | xargs -n 1 code-insiders --install-extension
```

# Install packages using winget
``` powershell
winget install -e Microsoft.WindowsTerminal
winget install -e Microsoft.AzureDataStudio
winget install -e Mozilla.Firefox
winget install -e Google.Chrome --force
winget install -e BraveSoftware.BraveBrowser
winget install -e OBSProject.OBSStudio
winget install -e Git.Git
winget install -e SlackTechnologies.Slack
winget install -e WinDirStat.WinDirStat
winget install -e SumatraPDF.SumatraPDF
winget install -e Python.Python
winget install -e Microsoft.dotnet
winget install -e TeamViewer.TeamViewer --force
winget install -e DigitalScholar.Zotero
winget install -e TheDocumentFoundation.LibreOffice
winget install -e Valve.Steam
winget install -e Oracle.VirtualBox
winget install -e VMware.WorkstationPlayer
winget install -e NordVPN.NordVPN
winget install -e JetBrains.IntelliJIDEA.Ultimate
winget install -e Google.AndroidStudio
winget install -e 7zip.7zip
winget install -e Ytmdesktop.Ytmdesktop
winget install -e --id VSCodium.VSCodium
winget install -e Chocolatey.ChocolateyGUI
winget install Neovim.Neovim
```

# Install packages using choco

### Launch Admin PowerShell
Install Chocolatey
``` powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
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


# Windows / WSL2 Setup

## WSL2

Create `projects` in Windows user directory, then symlink from WSL2:

```bash
ln -s /mnt/c/Users/ice/projects ~/projects
```

Git clone this repo in `~/projects`.

## Install Chocolatey

Launch Admin PowerShell:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

## Install Packages

```powershell
choco install -y docker-desktop
choco install -y fzf
choco install -y microsoft-windows-terminal
choco install -y mpv.install
choco install -y nerd-fonts-JetBrainsMono
choco install -y opencode
choco install -y ripgrep
choco install -y steam
choco install -y tailscale
choco install -y unzip
choco install -y vnc-viewer
choco install -y vscode.install
choco install -y wezterm
choco install -y zen-browser
```

## VS Code Config Symlinks

```cmd
mklink /h "C:\Users\ice\.ideavimrc" "C:\Users\ice\projects\dotfiles\.ideavimrc"
```

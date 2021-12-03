#!/bin/bash

sudo apt update
sudo apt upgrade

############# General Packages ############### 

# Terminal only
sudo apt install -y \
zsh \
ffmpeg \
fzf \
bat \
ranger \
python3-pip \
unzip \
zip \
tldr \
stow

sudo pip3 install youtube-dl

# GUI
sudo apt install -y \
mpv \
gnome-tweaks \
libnotify-bin \
snapd \
guake \
onedrive

# 'libnotify-bin' package contains bin 'notify-send' that is used by the Blueotooth shortcut

function install_deb {
  wget -O TEMP_DEB $1 &&
  sudo dpkg -i TEMP_DEB
  rm -f TEMP_DEB
}

############# NeoVim ############### 
# sudo wget https://github.com/neovim/neovim/releases/download/nightly/nvim.appimage -P /opt
# sudo chown ice /opt/nvim.appimage
# chmod u+x n/opt/vim.appimage
# sudo ln -s /opt/nvim.appimage /bin/vim

sudo add-apt-repository ppa:neovim-ppa/unstable
sudo apt-get update
sudo apt-get install neovim

############### ZSH ###############  

# Create a zsh config file that source settings in this projects
echo "source ~/projects/dotfiles/.zshrc" > ~/.zshrc

# Install ZSH Plugin manager, Antigen
curl -L git.io/antigen > ~/antigen.zsh

# Launch zsh when bash starts up
echo "zsh" >> ~/.bashrc

# Run zsh to finish the install manually
zsh

############# Rust ############### 

curl https://sh.rustup.rs -sSf | sh -s

source $HOME/.cargo/env # source to use cargo in current shell

############# Nodejs ############### 

# install nvm, nodejs version manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | zsh

source $HOME/.nvm/nvm.sh # source to use nvm in current shell
nvm install --lts
nvm alias default node

############# LunarVim setup ############### 

bash <(curl -s https://raw.githubusercontent.com/lunarvim/lunarvim/master/utils/installer/install.sh)

sudo ln -s ~/.local/bin/lvim /usr/local/bin/vim
rm ~/.config/lvim/config.lua
ln -s ~/projects/dotfiles/lvim/config.lua ~/.config/lvim/
# Install all packages headless
vim --headless -c 'autocmd User PackerComplete quitall' -c 'PackerSync'

############# NeoVim setup if not using LunarVim ############### 

# Install the plugin manager for `Neovim
sh -c 'curl -fLo "${XDG_DATA_HOME:-$HOME/.local/share}"/nvim/site/autoload/plug.vim --create-dirs \
       https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim'

# soft link settings files for nvim 
mkdir ~/.config
mkdir ~/.config/nvim
ln -s ~/projects/dotfiles/nvim/init.vim ~/.config/nvim/init.vim
ln -s ~/projects/dotfiles/nvim/plugin ~/.config/nvim/plugin
ln -s ~/projects/dotfiles/nvim/lua ~/.config/nvim/lua

# Install all the plugins
nvim --headless +PlugInstall +qall > /dev/null 2>&1

############ Ripgrep ############### 

wget -O TEMP_DEB 'https://github.com/BurntSushi/ripgrep/releases/download/13.0.0/ripgrep_13.0.0_amd64.deb' &&
sudo dpkg -i TEMP_DEB
rm -f TEMP_DEB

install_deb 'https://github.com/BurntSushi/ripgrep/releases/download/13.0.0/ripgrep_13.0.0_amd64.deb' 

############ Youtube Music ############### 

wget -O TEMP_DEB 'https://github.com/th-ch/youtube-music/releases/download/v1.13.0/youtube-music_1.13.0_amd64.deb'  &&
sudo dpkg -i TEMP_DEB
rm -f TEMP_DEB

############ Zenith (Htop) ############### 

wget -O TEMP_DEB 'https://github.com/bvaisvil/zenith/releases/download/0.12.0/zenith_0.12.0-1_amd64.deb' &&
sudo dpkg -i TEMP_DEB
rm -f TEMP_DEB

############# Google Chrome ############### 

wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install ./google-chrome-stable_current_amd64.deb
rm google-chrome-stable_current_amd64.deb

############# Appimagelauncher Packages ############### 

sudo add-apt-repository ppa:appimagelauncher-team/stable
sudo apt update
sudo apt install appimagelauncher

############# OBS Studio ############### 

# OBS Studio: After installing FFmpeg, install using:
sudo apt install v4l2loopback-dkms
sudo add-apt-repository ppa:obsproject/obs-studio
sudo apt install obs-studio
# OBS disconnect and unloads the v4l2loopback kernel module internally for some reason
# work around is when running obs virtual cam, remove the kernel module before running obs:
# sudo modprobe -r v4l2loopback; obs

# For WSL2
# ln -s /mnt/c/Users/ice/projects ~/projects

############### Fonts ###############  

# Download Meslo fonts, need to change terminal font
# Ref https://github.com/romkatv/powerlevel10k#meslo-nerd-font-patched-for-powerlevel10k

# fonts dir will does not exist yet
mkdir ~/.local/share/fonts
cd ~/.local/share/fonts
wget https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Regular.ttf
wget https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Bold.ttf
wget https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Italic.ttf
wget https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Bold%20Italic.ttf
cd ~


############### Intellij Idea Ultimate ###############  
# Inofficial Intellij Idea Ultimate PPA
# https://github.com/JonasGroeger/jetbrains-ppa
curl -s https://s3.eu-central-1.amazonaws.com/jetbrains-ppa/0xA6E8698A.pub.asc | gpg --dearmor | sudo tee /usr/share/keyrings/jetbrains-ppa-archive-keyring.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/jetbrains-ppa-archive-keyring.gpg] http://jetbrains-ppa.s3-website.eu-central-1.amazonaws.com focal main" | sudo tee /etc/apt/sources.list.d/jetbrains-ppa.list > /dev/null
sudo apt-get update
sudo apt-get install intellij-idea-ultimate

############# Intellij Idea vim plugin config ############### 

ln -s ~/projects/dotfiles/.ideavimrc ~/.ideavimrc

############### VSCode ###############  

# ctrl+shift+e is the emoji shortcut
# In terminal type ibus-setup, go to the emoji tab, and delete the keybindings.
# or
# using dconf: sudo apt-get install -y dconf-editor
# /desktop/ibus/panel/emoji/hotkey set to [] in the dconf editor too
# should respond with @as [] when running dconf read /desktop/ibus/panel/emoji/hotkey

# can now start with: GTK_IM_MODULE=ibus code

# Install Visual Studio Code

wget -O code https://code.visualstudio.com/sha/download?build=stable&os=linux-deb-x64
sudo apt install code

# cat ~/projects/dotfiles/vscode/extensions.txt | xargs -n 1 code-insiders --install-extension
mkdir ~/.config/Code/User/
rm ~/.config/Code/User/keybindings.json
ln -s ~/projects/dotfiles/vscode/keybindings.json ~/.config/Code/User/keybindings.json
rm ~/.config/Code/User/settings.json
ln -s ~/projects/dotfiles/vscode/settings.json ~/.config/Code/User/settings.json

############### NordVPN ###############  

sh <(curl -sSf https://downloads.nordcdn.com/apps/linux/install.sh)

############### Kotlin sdk ###############  

export SDKMAN_DIR=~/.sdkman && curl -s "https://get.sdkman.io" | bash
source ~/.sdkman/bin/sdkman-init.sh # init in this terminal
sdk install gradle
sdk install kotlin
# supports apple m1
sdk install java 8.0.312-zulu
sdk install java 11.0.13-zulu
# sdk install java 11.0.12-open 

############### Chrome driver ############### 

sudo mkdir /opt/chromedriver/
sudo wget  "https://chromedriver.storage.googleapis.com/92.0.4515.43/chromedriver_linux64.zip" -P /opt/chromedriver/
sudo unzip /opt/chromedriver/chromedriver_linux64.zip -d /opt/chromedriver/
sudo chmod +x /opt/chromedriver/chromedriver
sudo rm /usr/local/bin/chromedriver
sudo ln -s /opt/chromedriver/chromedriver /usr/local/bin/chromedriver 

############### Kernel-based Virtual Machine (KVM) ############### 

# sudo apt purge qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils virtinst virt-manager
# sudo apt install qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils virtinst virt-manager
# sudo usermod -aG libvirt $USER
# sudo usermod -aG kvm $USER

### Install docker ###

sudo apt install -y docker.io
sudo usermod -aG docker $USER

# Docker compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.0.1/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# To install google-cloud-sdk
# https://cloud.google.com/sdk/docs/quickstart#deb
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -
sudo apt update
sudo apt install -y google-cloud-sdk
gcloud init

# To install kubectl
sudo curl -fsSLo /usr/share/keyrings/kubernetes-archive-keyring.gpg https://packages.cloud.google.com/apt/doc/apt-key.gpg
echo "deb [signed-by=/usr/share/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" | sudo tee /etc/apt/sources.list.d/kubernetes.list
sudo apt-get update
sudo apt-get install -y kubectl

# Install kubectx and kubens. switch between Kubernetes contexts/namespaces
sudo mkdir /opt/kubectx/
sudo mkdir /opt/kubens/
sudo wget https://github.com/ahmetb/kubectx/releases/download/v0.9.1/kubectx -P /opt/kubectx 
sudo wget https://github.com/ahmetb/kubectx/releases/download/v0.9.1/kubens -P /opt/kubens
sudo chmod +x /opt/kubectx/kubectx
sudo chmod +x /opt/kubens/kubens

sudo ln -s /opt/kubectx/kubectx /usr/local/bin/kubectx 
sudo ln -s /opt/kubens/kubens /usr/local/bin/kubens 

# Stern
sudo mkdir /opt/stern/
sudo wget --output-document /opt/stern/stern https://github.com/wercker/stern/releases/download/1.11.0/stern_linux_amd64
sudo chmod +x /opt/stern/stern
sudo ln -s /opt/stern/stern /usr/local/bin/stern 

# Kind allows to create cluster with docker, vscode friendly
sudo mkdir /opt/kind/
sudo wget --output-document /opt/kind/kind https://kind.sigs.k8s.io/dl/v0.10.0/kind-linux-amd64
sudo chmod +x /opt/kind/kind
sudo ln -s /opt/kind/kind /usr/local/bin/kind 
# Use kind instead of minikube, will allow vscode to mount image
# https://kind.sigs.k8s.io/docs/user/quick-start/#installation

# Kustomize
curl -s "https://raw.githubusercontent.com/\
kubernetes-sigs/kustomize/master/hack/install_kustomize.sh"  | bash
sudo mkdir /opt/kustomize/
sudo mv kustomize /opt/kustomize/
sudo chmod +x /opt/kustomize/kustomize
sudo ln -s /opt/kustomize/kustomize /usr/local/bin/kustomize 

############# .Net sdk ############### 

# Reference: https://docs.microsoft.com/en-us/dotnet/core/install/linux-ubuntu
wget https://packages.microsoft.com/config/ubuntu/20.10/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
sudo apt-get update;
sudo apt-get install -y apt-transport-https
sudo apt-get update
sudo apt-get install -y dotnet-sdk-5.0

############# Zotero  ############### 

# Repo: https://github.com/retorquere/zotero-deb
wget -qO- https://github.com/retorquere/zotero-deb/releases/download/apt-get/install.sh | sudo bash
sudo apt update
sudo apt install -y zotero

############# Power Management ############### 

# tlp and thermald can work together
# No need to install, using smbios to limit CPU power
# sudo apt install -y tlp tlp-rdw --no-install-recommends
# sudo apt install thermald

sudo apt install -y s-tui # gui console temp

### Dell Power Manager ###

sudo apt install -y smbios-utils
sudo smbios-thermal-ctl --set-thermal-mode quiet  # quiet # default is balanced
# see https://github.com/JackHack96/dell-xps-9570-ubuntu-respin/wiki/Some-useful-tips-and-tricks#thermal-modes
# Show current thermal modes: smbios-thermal-ctl -g
# List all available thermal modes: smbios-thermal-ctl -i
# "Quiet" and "Cool Bottom" profiles limit CPU power to 11W (18W boost) and thus reduces overall system performance.
# "Balanced" and "Performance" profiles remove this limit.


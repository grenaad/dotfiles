#!/bin/bash

sudo apt update

############# General Packages ############### 

# Terminal only
sudo apt install -y \
zsh \
ffmpeg \
fzf \
bat \
ranger \
python3-pip
#neovim \

# GUI
sudo apt install -y \
mpv \
gnome-tweaks \
libnotify-bin \
snapd \
guake \
onedrive

# Install neovim 0.5, used by telescope plugin
wget -P ~ https://github.com/neovim/neovim/releases/download/v0.5.0/nvim.appimage
chmod u+x ~/nvim.appimage
echo 'alias nvim="nvim.appimage"' >> ~/.bashrc

# Install ripgrep
wget -O TEMP_DEB 'https://github.com/BurntSushi/ripgrep/releases/download/13.0.0/ripgrep_13.0.0_amd64.deb' &&
sudo dpkg -i TEMP_DEB
rm -f TEMP_DEB

# 'libnotify-bin' package contains bin 'notify-send'

sudo pip3 install youtube-dl

# For WSL2
ln -s /mnt/c/Users/ice/projects ~/projects

############### ZSH ###############  

# Create a zsh config file that source settings in this projects
echo "source ~/projects/dotfiles/.zshrc" > ~/.zshrc

# Install ZSH Plugin manager, Antigen
curl -L git.io/antigen > ~/antigen.zsh

# Download Meslo fonts, need to change terminal font
# Ref https://github.com/romkatv/powerlevel10k#meslo-nerd-font-patched-for-powerlevel10k

# fonts dir will does not exist yet
mkdir ~/.local/share/fonts
wget https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Regular.ttf -P /.local/share/fonts/
wget https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Bold.ttf -P /.local/share/fonts/
wget https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Italic.ttf -P /.local/share/fonts/
wget https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Bold%20Italic.ttf -P /.local/share/fonts/

# Launch zsh when bash starts up
echo "zsh" >> ~/.bashrc

# Run zsh to finish the install manually
zsh

############### VSCode ###############  

# ctrl+shift+e is the emoji shortcut
# In terminal type ibus-setup, go to the emoji tab, and delete the keybindings.
# or
# using dconf: sudo apt-get install -y dconf-editor
# /desktop/ibus/panel/emoji/hotkey set to [] in the dconf editor too
# should respond with @as [] when running dconf read /desktop/ibus/panel/emoji/hotkey

# can now start with: GTK_IM_MODULE=ibus code

# Using Code Insider

wget -O code-insiders https://code.visualstudio.com/sha/download?build=insider&os=linux-deb-x64
sudo apt update
sudo apt install code-insiders

cat ~/projects/dotfiles/vscode/extensions.txt | xargs -n 1 code-insiders --install-extension
mkdir ~/.config/Code\ -\ Insiders/User/
ln -s ~/projects/dotfiles/vscode/keybindings.json ~/.config/Code\ -\ Insiders/User/keybindings.json
ln -s ~/projects/dotfiles/vscode/settings.json ~/.config/Code\ -\ Insiders/User/settings.json

############### NordVPN ###############  

sh <(curl -sSf https://downloads.nordcdn.com/apps/linux/install.sh)

############### Kotlin sdk ###############  

sudo apt install -y default-jdk
export SDKMAN_DIR=~/.sdkman && curl -s "https://get.sdkman.io" | bash
source ~/.sdkman/bin/sdkman-init.sh # init in this terminal
sdk install gradle
sdk install kotlin


############### Chrome driver ############### 

sudo mkdir /opt/chromedriver/
sudo wget  "https://chromedriver.storage.googleapis.com/91.0.4472.101/chromedriver_linux64.zip" -P /opt/chromedriver/
sudo unzip /opt/chromedriver/chromedriver_linux64.zip -d /opt/chromedriver/
sudo chmod +x /opt/chromedriver/chromedriver
sudo ln -s /opt/chromedriver/chromedriver /usr/local/bin/chromedriver 

############### Kernel-based Virtual Machine (KVM) ############### 

# sudo apt purge qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils virtinst virt-manager
# sudo apt install qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils virtinst virt-manager
# sudo usermod -aG libvirt $USER
# sudo usermod -aG kvm $USER

### Install docker ###

sudo apt install -y docker.io
sudo usermod -aG docker $USER

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

############# Nodejs ############### 

# install nvm, nodejs version manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.37.2/install.sh | bash
source ~/.nvm/nvm.sh
echo "source ~/.nvm/nvm.sh" >> ~/.zshrc
nvm install --lts

############# NeoVim ############### 

# Requires nodejs for the coc plugin

# Install the plugin manager for `Neovim
sh -c 'curl -fLo "${XDG_DATA_HOME:-$HOME/.local/share}"/nvim/site/autoload/plug.vim --create-dirs \
       https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim'

# soft link settings files for nvim and coc
mkdir ~/.config/nvim
ln -s ~/projects/dotfiles/nvim/init.vim ~/.config/nvim/init.vim
ln -s ~/projects/dotfiles/nvim/plugin ~/.config/nvim/plugin
ln -s ~/projects/dotfiles/nvim/lua ~/.config/nvim/lua

# Install all the plugins
nvim --headless +PlugInstall +qall > /dev/null 2>&1

############# Power Management ############### 

# tlp and thermald can work together
# No need to install, using smbios to limit CPU power
sudo apt install -y tlp tlp-rdw --no-install-recommends
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


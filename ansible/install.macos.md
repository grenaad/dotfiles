## Brew Packages

### Commandline

To view top level packages command line 

```bash
brew leaves | xargs -n1 brew desc
```

- docker: Pack, ship and run any application as a lightweight container
- docker-machine: Create Docker hosts locally and on cloud providers
- ffmpeg: Play, record, convert, and stream audio and video
- fzf: Command-line fuzzy finder written in Go
- kubectx: Tool that can switch between kubectl contexts easily and create aliases
- neovim: Ambitious Vim-fork focused on extensibility and agility
- nvm: Manage multiple Node.js versions
- pyenv: Python version management
- ranger: File browser
- ripgrep-all: Wrapper around ripgrep that adds multiple rich file types
- rust: Safe, concurrent, practical language
- stern: Tail multiple Kubernetes pods & their containers
- tldr
- tmux


### Cask

Bew cask Package can be listed with:
```bash
brew list --cask
```

- chromedriver
- google-chrome
- intellij-idea
- mpv
- onedrive
- slack
- yt-music
- zoom
- brave-browser
- firefox
- google-cloud-sdk
- iterm2
- obs
- postman
- visual-studio-code
- ytmdesktop-youtube-music

### Python Version manager 
Install python:
`pyenv install 3.10.0`

## ZSH   
Source this repo's `.zshrc` file during startup

```bash
echo "source ~/projects/dotfiles/.zshrc" > ~/.zshrc
```

Install ZSH Plugin manager, Antigen
```bash
curl -L git.io/antigen > ~/antigen.zsh
```

Install Oh my zsh
```bash
$ sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

## Java and Kotlin sdk Version manager 
```bash
curl -s "https://get.sdkman.io" | bash
source ~/.sdkman/bin/sdkman-init.sh # init in this terminal
sdk install gradle
sdk install kotlin
sdk install java 11.0.13-zulu
```

## Window manager
`yabai` is the window manager, `skhd` is a hotkey daemon.

```bash
brew install koekeishiya/formulae/yabai ## window manager
brew services start koekeishiya/formulae/yabai
brew install koekeishiya/formulae/skhd ## hotkey daemon
brew services start koekeishiya/formulae/skhd
brew install jq # json parser, used in scripts
```

Link config file

```bash
ln ~/projects/dotfiles/macos/.yabairc ~/.yabairc  # have to hard link to able to run script
ln -s ~/projects/dotfiles/macos/.skhdrc ~/.skhdrc
```

TODO: Create macos install script

```bash
# Ensure Apple's command line tools are installed
if ! command -v cc >/dev/null; then
  fancy_echo "Installing xcode ..."
  xcode-select --install 
else
  fancy_echo "Xcode already installed. Skipping."
fi

if ! command -v brew >/dev/null; then
  fancy_echo "Installing Homebrew..."
  ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)" </dev/null
else
  fancy_echo "Homebrew already installed. Skipping."
fi

# [Install Ansible](http://docs.ansible.com/intro_installation.html).
if ! command -v ansible >/dev/null; then
  fancy_echo "Installing Ansible ..."
  brew install ansible 
else
  fancy_echo "Ansible already installed. Skipping."
fi

fancy_echo "Running ansible playbook ..."
ansible-playbook playbook.yml -i hosts --ask-sudo-pass -vvvv
```


```bash
ansible-playbook with --ask-become-pass
```


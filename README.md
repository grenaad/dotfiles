# Dot Files

Current dofiles is separated into 2 parts, `configs/` which stores all the configs and  `ansible/` that used to install all the applications. Ansible is used for both macos and ubunut.

## Configs

See: `configs/`

This is using `stow` to symbolic link config files from this repo to the system.

Examples

just using symlinking the nvim directory:
``` bash
stow -t ~/ nvim  
``` 

all directories(all configs)
``` bash
stow -t ~/ */ 
``` 

## Ansible

Using ansible to install most core applications for the different OS. See `./ansible/README.md`

## Other

### Vim cheat sheet
https://gist.github.com/tuxfight3r/0dca25825d9f2608714b

### Setup
clone repo into `~/projects/`, Run `install.sh` to setup

###  Mpv
Add keyboard shortcut to play links copied to clipboard, `libnotify-bin` package contains bin `notify-send`

``` bash
sh -c 'notify-send -t 7000 --icon=mpv "Playing video" "$(xclip -selection clipboard -o)"; mpv "$(xclip -selection clipboard -o)"'
```

###  Bluetooth

To allow bluetooth device to auto connect:
`bluetoothctl trust C4:30:18:DA:A5:16`

Can also add shortcut
``` bash
sh -c 'notify-send -t 1 -h int:transient:1 --icon=mpv "Connecting bluetooth devices"; bluetoothctl connect C4:30:18:DA:A5:16'
```

Add bluetooth settings `/etc/bluetooth/main.conf`

``` bash
AutoEnable=true # Allows to auto connect devices
# Enable=Source,Sink,Media,Socket # Advertise as a A2DP sink
```

### Dell docking station 

Need to add [kernel parameter](https://wiki.archlinux.org/index.php/Dell_XPS_13_2-in-1_(7390)
) to disable MST for the dock. Adding this option prohibits the dock to drive more than 1 screen via DP or HDMI.
Can still add a 2nd screen with a USBC to HDMI/DP adapter when plugged into the back to the USBC thunderbolt port.

Pop OS uses `kernalstub`, too see the current configurations: 
``` bash
vim /etc/kernelstub/configuration
```
Add the kernel parameter with:

``` bash
sudo kernelstub -o "i915.enable_dp_mst=0"
```

See 
[this](https://www.dell.com/community/XPS/XPS-13-9300-and-WD19TB-linux-problem/m-p/7723066/highlight/true#M72030)
post when running multiple screens

### VsCode

Ctrl+Shift+E inserts special characters into file instead of showing Explorer Pane in VS Code
Run `ibus-setup` in the terminal. A GUI dialog will open.
Go to the 'Emoji' tab --> Ellipsis(...) buttton --> Delete --> OK.

## Switching Windows in Ubuntu 

See [this post](https://techwiser.com/ubuntu-alt-tab-ungroup/)

To turn on switch-windows instead of switch-applications
``` bash
gsettings set org.gnome.desktop.wm.keybindings switch-windows "['<Alt>Tab']"
``` 

To revert
``` bash
gsettings set org.gnome.desktop.wm.keybindings switch-windows []
gsettings set org.gnome.desktop.wm.keybindings switch-applications "['<Alt>Tab']"
``` 

Can also be done with GUI settings in Keybord shortcuts, add the `Alt+Tab` shortcut to `Switch windows`

### Tmux

TODO: look into vi mode
tmux has a built-in vi-mode for copy mode
```
set-window-option -g mode-keys vi
bind-key -t vi-copy v begin-selection
bind-key -t vi-copy y copy-selection
```

prefix + [    enter copy mode
V                 visually select lines
v                  toggle visual block mode
space         start selection
enter           copy it and leave copy mode

### F#

```bash
PATH=$PATH:~/.dotnet/tools/
dotnet tool install --global fsautocomplete
```

### Windows 
For nerdfont installation
```
curl.exe https://webi.ms/nerdfont | powershell
```

```
yabai --start-service
shkd --start-service
```


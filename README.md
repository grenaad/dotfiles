# Dot Files

## Vim cheat sheet
https://gist.github.com/tuxfight3r/0dca25825d9f2608714b

## Setup
clone repo into `~/projects/`, Run `install.sh` to setup

## Mpv
Add keyboard shortcut to play links copied to clipboard, `libnotify-bin` package contains bin `notify-send`

``` bash
sh -c 'notify-send -t 7000 --icon=mpv "Playing video" "$(xclip -selection clipboard -o)"; mpv "$(xclip -selection clipboard -o)"'
```

## Bluetooth

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

## Dell docking station 

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

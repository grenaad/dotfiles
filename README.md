# Dotfiles

Dotfiles separated into two parts: `configs/` stores all configuration files and `ansible/` handles installation of applications. Ansible supports both macOS and Ubuntu/WSL.

## Quick Start

```bash
# Install Ansible
make install_ansible

# Run full setup (installs packages, symlinks configs, sets up shell)
make install
```

See `make help` for all available targets.

## Configs

See: `configs/`

Uses `stow` to symlink config files from this repo to the system.

Symlink a single config:

```bash
stow -t ~/ nvim
```

Symlink all configs:

```bash
stow -t ~/ */
```

Unsymlink all configs:

```bash
make unstow
```

### Available Configs

`aerospace`, `ghostty`, `idea`, `lazygit`, `nerdfonts`, `nvim`, `opencode`, `raycast`, `scripts`, `sketchy_bar`, `tiling`, `tmux`, `vscode`, `yazi`, `zsh`

## Ansible

Uses Ansible to install applications for both macOS and Ubuntu/WSL. See `ansible/README.md` for details.

### Key Make Targets

| Target | Description |
|---|---|
| `make install` | Full installation |
| `make dotfiles` | Dotfiles configurations only |
| `make packages` | OS-specific packages only |
| `make stow` | Symlink all configs |
| `make homebrew` | Homebrew and CLI packages |
| `make tmux` | Tmux plugins |

## Tips

### Mpv

Add keyboard shortcut to play links copied to clipboard (`libnotify-bin` package contains `notify-send`):

```bash
sh -c 'notify-send -t 7000 --icon=mpv "Playing video" "$(xclip -selection clipboard -o)"; mpv "$(xclip -selection clipboard -o)"'
```

### VS Code

`Ctrl+Shift+E` inserts special characters instead of showing Explorer Pane.
Fix: run `ibus-setup` in the terminal, go to the Emoji tab, click the ellipsis (...) button, delete, and OK.

### Windows

For Nerd Font installation:

```
choco install nerd-fonts-jetbrainsmono
```

See `install_win.md` for Windows-specific setup.

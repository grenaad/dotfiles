# Ansible Installation and Setup

Ansible is used to automate the installation of packages and configuration for both macOS and Ubuntu/WSL.

## Prerequisites

Install Ansible and its dependencies:

```bash
make install_ansible
# or
./ansible/install_ansible.sh
```

## Usage

Run the full installation from the project root:

```bash
make install
```

This runs the main Ansible playbook with `--ask-become-pass` (sudo) and `--ask-vault-pass` (encrypted secrets like SSH keys).

### Available Make Targets

| Target | Description |
|---|---|
| `make install` | Full installation (all tasks) |
| `make dotfiles` | Install dotfiles configurations |
| `make packages` | Install OS-specific packages |
| `make stow` | Run stow for all configs |
| `make env` | Copy `.env` file (requires vault password) |
| `make ssh` | Setup SSH configurations (requires vault password) |
| `make git` | Setup Git configurations (requires vault password) |
| `make ghostty` | Install Ghostty terminal |
| `make homebrew` | Install Homebrew and packages |
| `make tmux` | Install tmux plugins |
| `make check` | Syntax check the playbook |
| `make install-verbose` | Full install with verbose output |
| `make install-dry` | Dry run (no changes) |

## What Gets Installed

### All Platforms

- **SSH keys and config** (vault-encrypted)
- **Git configs** (personal, work, work2, work3)
- **Rust** via rustup
- **TPM** (Tmux Plugin Manager) + tmux plugins
- **Stow** symlinks all configs from `configs/` to `$HOME`
- **Zsh** shell configuration

### Ubuntu / WSL

**System packages (apt):** wl-clipboard, zsh, ffmpeg, unzip, zip, stow, mpv, make, parallel, tmux

**Homebrew packages:** bat, fzf, git-delta, lazygit, neovim, opencode, ripgrep, tlrc, yazi

**Other:** VS Code, Rust

### macOS

All packages are installed via Homebrew, including:

**Formulae:** neovim, bat, fzf, git-delta, lazygit, tmux, ripgrep, tlrc, yazi, opencode, k9s, btop, go, gh, and more

**Cask apps:** Docker, Firefox, Ghostty, Zen, Raycast, Aerospace, SketchyBar, and more

See `packages-macos.yaml` for the full list.

## Playbook Structure

```
ansible/
  main.yaml              # Entry point - runs all tasks
  packages-ubuntu.yaml   # Ubuntu/WSL specific packages
  packages-macos.yaml    # macOS specific packages (uses geerlingguy.mac role)
  tasks/
    env.yaml             # .env file (vault-encrypted)
    ssh.yaml             # SSH keys and config
    git.yaml             # Git configurations
    rust.yaml            # Rust toolchain
    tmux.yaml            # TPM (Tmux Plugin Manager)
    homebrew.yaml        # Linuxbrew + CLI packages
    vscode.yaml          # VS Code via apt repo
    ...
```

## Tags

All tasks are tagged with `install` and `dotfiles`. Specific tags:

| Tag | What it covers |
|---|---|
| `dotfiles` | All configuration tasks |
| `packages` | apt and brew package installation |
| `homebrew` | Homebrew setup and packages |
| `env` | .env file |
| `ssh` | SSH keys and config |
| `git` | Git configurations |
| `tmux` | TPM and tmux plugins |
| `stow` | Stow symlink step |
| `ghostty` | Ghostty terminal |
| `rust` | Rust toolchain |
| `vscode` | VS Code |

Run a specific tag: `cd ansible && ansible-playbook main.yaml --tags <tag>`

## Troubleshooting

If brew commands fail on macOS, run `brew doctor` to diagnose issues.

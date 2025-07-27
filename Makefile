.PHONY: help install core dotfiles env ssh git nvm rust packages stow check install_ansible

# Default target
help:
	@echo "Dotfiles Ansible Makefile"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Main targets:"
	@echo "  install    - Run full installation (all tasks)"
	@echo "  core       - Install core packages and tools"
	@echo "  dotfiles   - Install dotfiles configurations"
	@echo "  packages   - Install OS-specific packages"
	@echo "  stow       - Run stow for all configs"
	@echo ""
	@echo "Specific tasks:"
	@echo "  env        - Copy .env file"
	@echo "  ssh        - Setup SSH configurations"
	@echo "  git        - Setup Git configurations"
	@echo "  nvm        - Install Node Version Manager"
	@echo "  rust       - Install Rust toolchain"
	@echo "  neovim     - Install Neovim"
	@echo "  ghostty    - Install Ghostty terminal"
	@echo "  opencode   - Install OpenCode"
	@echo ""
	@echo "Utility targets:"
	@echo "  check      - Run ansible-playbook syntax check"
	@echo "  deps       - Install ansible dependencies"

# Install ansible if not present
install_ansible:
	./ansible/install_ansible.sh

# Check playbook syntax
check:
	cd ansible && ansible-playbook main.yaml --syntax-check

# Full installation
install: 
	cd ansible && ansible-playbook main.yaml

# Core packages and tools
core: 
	cd ansible && ansible-playbook main.yaml --tags core

# Dotfiles configurations
dotfiles: 
	cd ansible && ansible-playbook main.yaml --tags dotfiles

# OS-specific packages
packages: 
	cd ansible && ansible-playbook main.yaml --tags packages

# Individual tasks
env: 
	cd ansible && ansible-playbook main.yaml --tags env --ask-vault-pass

ssh: 
	cd ansible && ansible-playbook main.yaml --tags ssh --ask-vault-pass

git: 
	cd ansible && ansible-playbook main.yaml --tags git --ask-vault-pass

neovim:
	cd ansible && ansible-playbook main.yaml --tags neovim

ghostty:
	cd ansible && ansible-playbook main.yaml --tags ghostty

opencode:
	cd ansible && ansible-playbook main.yaml --tags opencode

# Run stow manually
stow:
	cd configs && stow -t "$$HOME" */

# Unstow all configs
unstow:
	cd configs && stow -D -t "$$HOME" */

# Verbose mode targets
install-verbose:
	cd ansible && ansible-playbook main.yaml -v

core-verbose:
	cd ansible && ansible-playbook main.yaml --tags core -v

# Dry run targets
install-dry:
	cd ansible && ansible-playbook main.yaml --check

core-dry:
	cd ansible && ansible-playbook main.yaml --tags core --check

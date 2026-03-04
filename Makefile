.PHONY: help install dotfiles packages env ssh git stow unstow check install_ansible

# Default target
help:
	@echo "Dotfiles Ansible Makefile"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Main targets:"
	@echo "  install    - Run full installation (all tasks)"
	@echo "  dotfiles   - Install dotfiles configurations"
	@echo "  packages   - Install OS-specific packages"
	@echo "  stow       - Run stow for all configs"
	@echo ""
	@echo "Specific tasks:"
	@echo "  env        - Copy .env file"
	@echo "  ssh        - Setup SSH configurations"
	@echo "  git        - Setup Git configurations"
	@echo "  ghostty    - Install Ghostty terminal"
	@echo "  homebrew   - Install Homebrew and packages"
	@echo "  tmux       - Install tmux plugins"
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
	cd ansible && ansible-playbook main.yaml --ask-become-pass --ask-vault-pass

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

ghostty:
	cd ansible && ansible-playbook main.yaml --tags ghostty

homebrew:
	cd ansible && ansible-playbook main.yaml --tags homebrew

tmux:
	cd ansible && ansible-playbook main.yaml --tags tmux

# Run stow manually
stow:
	cd configs && stow -t "$$HOME" */

# Unstow all configs
unstow:
	cd configs && stow -D -t "$$HOME" */

# Verbose mode targets
install-verbose:
	cd ansible && ansible-playbook main.yaml -v

dotfiles-verbose:
	cd ansible && ansible-playbook main.yaml --tags dotfiles -v

# Dry run targets
install-dry:
	cd ansible && ansible-playbook main.yaml --check

dotfiles-dry:
	cd ansible && ansible-playbook main.yaml --tags dotfiles --check

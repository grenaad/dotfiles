#!/bin/bash

# This script installs ansible and the roles required to use it 
# For macos see roles: https://github.com/geerlingguy/mac-dev-playbook 

if [[ "$OSTYPE" == "darwin"* ]]; then

  if ! command -v brew >/dev/null; then
    echo "Installing brew ..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  else
    echo "Brew already installed. Skipping"
  fi

  # Ensure Apple's command line tools are installed
  if ! command -v cc >/dev/null; then
    echo "Installing xcode ..."
    xcode-select --install
  else
    echo "Xcode already installed. Skipping."
  fi

  if ! command -v ansible >/dev/null; then
    echo "Installing ansible ..."
    brew install ansible
  else
    echo "Ansible  already installed. Skipping."
  fi

fi

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  if ! command -v ansible >/dev/null; then
    echo "Installing ansible ..."
    sudo apt update
    sudo apt install -y software-properties-common
    sudo add-apt-repository --yes --update ppa:ansible/ansible
    sudo apt install -y ansible
  else
    echo "Ansible  already installed. Skipping."
  fi

fi

# install the roles required
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ansible-galaxy install -r "$SCRIPT_DIR/requirements.yml"

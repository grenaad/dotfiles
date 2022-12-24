# Ansible installation and setup

- `installl_ansible.sh`
    - To install `ansible` and the roles that it will use.
- `ansible-playbook install-packges-ubuntu.yaml --ask-become-pass`
    - Install packages per OS `ubuntu` or `macos`
- `ansible-playbook general.yaml --ask-become-pass --ask-vault-pass`
    - Setup ssh, git, rustup, python, nvim, lunar vim
- `ansible-playbook configure.yaml`
    - Add configs for all the applications

### If some brew commands fail, need to agree to Xcode's license or fix them using:
`brew doctor`

## TODO: Add Rust

- linux: `curl https://sh.rustup.rs -sSf | sh`
- macos: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

```bash
brew install rustup
rustup-init # Next let's setup cargo and rustc,
```

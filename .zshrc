############# Load Aliases ############### 

source <(kubectl completion zsh)

# Load alias
source ~/projects/dotfiles/.bashrc

############# ZSH Plugins ############### 

# Using the Plugin manager Antigen, Install with:
# curl -L git.io/antigen > ~/antigen.zsh
# reference: https://thorsten-hans.com/frictionless-zsh-and-oh-my-zsh-management-with-antigen
# Verify and validate Antigen loads: antigen list --long

# Load Antigen
source ~/antigen.zsh

## load and configure the ZSH-framework, oh-my-zsh
antigen use oh-my-zsh

## Load plugins
antigen bundle git
antigen bundle docker
antigen bundle kubernetes
antigen bundle zsh-users/zsh-autosuggestions
antigen bundle zsh-users/zsh-syntax-highlighting
antigen bundle vi-mode
antigen bundle kubectl

antigen theme romkatv/powerlevel10k

# 3. Commit Antigen Configuration
antigen apply

############# ZSH Plugins END ############### 

" #### Plugins ####
call plug#begin('~/.vim/plugged')

Plug 'neovim/nvim-lspconfig'
Plug 'hrsh7th/nvim-compe'

"Plug 'neoclide/coc.nvim', {'branch': 'release'} 

let g:fzf_install = 'yes | ./install'
Plug 'junegunn/fzf', { 'do': g:fzf_install }

" Text editing
Plug 'scrooloose/nerdcommenter' " Comment functions so powerful, no comment necessary.
Plug 'tpope/vim-surround' " Provides mappings to change surroundings in pairs.
Plug 'jiangmiao/auto-pairs' " Insert or delete brackets, parens, quotes in pair

" Icons for Nerd Font
Plug 'ryanoasis/vim-devicons'

" Navigation
Plug 'airblade/vim-rooter' " set the working directory automatically 
Plug 'preservim/nerdtree'
Plug 'nvim-lua/popup.nvim'
Plug 'nvim-lua/plenary.nvim'
Plug 'nvim-telescope/telescope.nvim'
Plug 'nvim-telescope/telescope-fzy-native.nvim'

" Git
Plug 'tpope/vim-fugitive'
Plug 'vim-airline/vim-airline' " Display git branch on bottom
Plug 'stsewd/fzf-checkout.vim' " Opens a window to checkout a branch

" Syntax higlighting
Plug 'udalov/kotlin-vim'
Plug 'nvim-treesitter/nvim-treesitter', {'do': ':TSUpdate'}  " We recommend updating the parsers on update

Plug 'gruvbox-community/gruvbox'

call plug#end()

colorscheme gruvbox
highlight Normal guibg=None

source ~/projects/dotfiles/nvim/plugins.vimrc
source ~/projects/dotfiles/nvim/general.vimrc

luafile ~/projects/dotfiles/nvim/compe-config.lua
luafile ~/projects/dotfiles/nvim/python-lsp.lua
luafile ~/projects/dotfiles/nvim/bash-lsp.lua


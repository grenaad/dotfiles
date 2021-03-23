" #### Plugins ####
call plug#begin('~/.vim/plugged')

Plug 'neoclide/coc.nvim', {'branch': 'release'} 

let g:fzf_install = 'yes | ./install'
Plug 'junegunn/fzf', { 'do': g:fzf_install }

Plug 'tpope/vim-surround' " Provides mappings to change surroundings in pairs.
Plug 'jiangmiao/auto-pairs' " Insert or delete brackets, parens, quotes in pair
Plug 'airblade/vim-rooter' " set the working directory automatically 

" Initialize plugin system
" icons for Nerd Font
Plug 'ryanoasis/vim-devicons'

call plug#end()

source ~/projects/dotfiles/nvim/plugins.vimrc
source ~/projects/dotfiles/nvim/general.vimrc


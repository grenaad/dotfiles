" #### Plugins ####
call plug#begin('~/.vim/plugged')

Plug 'neoclide/coc.nvim', {'branch': 'release'} 

let g:fzf_install = 'yes | ./install'
Plug 'junegunn/fzf', { 'do': g:fzf_install }

Plug 'tpope/vim-surround' " Provides mappings to change surroundings in pairs.
Plug 'jiangmiao/auto-pairs' " Insert or delete brackets, parens, quotes in pair
Plug 'airblade/vim-rooter' " set the working directory automatically 

" Icons for Nerd Font
Plug 'ryanoasis/vim-devicons'

" Navigation
Plug 'preservim/nerdtree'

" Git
Plug 'tpope/vim-fugitive'
Plug 'vim-airline/vim-airline' " Display git branch on bottom
Plug 'stsewd/fzf-checkout.vim' " Opens a window to checkout a branch

call plug#end()

source ~/projects/dotfiles/nvim/plugins.vimrc
source ~/projects/dotfiles/nvim/general.vimrc


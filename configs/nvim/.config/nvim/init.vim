" https://github.com/LunarVim/LunarVim/tree/00794985c214177286d01a4cbec8f495d34f0c4e
" Options
set smartcase

" Set leader to spacebar
let mapleader=" "
nnoremap <Space> <Nop>

" Better indenting
vnoremap < <gv
vnoremap > >gv

" if global var 'vscode' exist, then nvim is been called from vscode
if exists('g:vscode')
  source ~/.config/nvim/init.vscode.vim
else

endif


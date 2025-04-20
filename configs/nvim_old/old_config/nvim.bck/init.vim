"https://github.com/LunarVim/LunarVim/tree/00794985c214177286d01a4cbec8f495d34f0c4e
" Options
set smartcase
set clipboard=unnamedplus               " Copy paste between vim and everything else

" Set leader to spacebar
" let mapleader=" "
" nnoremap <Space> <Nop>

" Better indenting
vnoremap < <gv
vnoremap > >gv

vnoremap <leader>P \"_dP

" if global var 'vscode' exist, then nvim is been called from vscode
if exists('g:vscode')
  source ~/.config/nvim/init.vscode.vim
else

endif


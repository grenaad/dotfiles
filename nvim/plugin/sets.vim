syntax enable
set clipboard+=unnamedplus
set encoding=utf-8
set number
set relativenumber
set tabstop=4 softtabstop=4 
"set nohlsearch
set nowrap
set hidden
set smartcase
set ignorecase
set title
set titlestring=%{hostname()}\ \ %F\ \ %{strftime('%Y-%m-%d\ %H:%M',getftime(expand('%')))}
set noswapfile
set nobackup
set undodir=~/.vim/undodir
set undofile
set noerrorbells
set incsearch 
set scrolloff=8 
set signcolumn=yes
set shortmess+=A " don't give annoying message about swap file found

" Open new split panes to right and bottom, which feels more natural than Vim’s default:
set splitbelow splitright

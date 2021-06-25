" ######  Terminal Function ###### 
"
" Opens 12 rows height split with terminal at the bottom, and minimizes it if it already open.
" Maps Esc to go back to normal mode and :q to close the window
let g:term_buf = 0
let g:term_win = 0
function! TermToggle(height)
    if win_gotoid(g:term_win)
	hide
    else
	botright new
	exec "resize " . a:height
	try
	    exec "buffer " . g:term_buf
	catch
	    call termopen($SHELL, {"detach": 0, "cwd": $VIM_DIR})
	    let g:term_buf = bufnr("")
	    set nonumber
	    set norelativenumber
	    set signcolumn=no
	endtry
	startinsert!
	let g:term_win = win_getid()
    endif
endfunction

" Toggle terminal on/off (neovim)
nnoremap <C-t> :call TermToggle(12)<CR>
inoremap <C-t> <Esc>:call TermToggle(12)<CR>
tnoremap <C-t> <C-\><C-n>:call TermToggle(12)<CR>

" Terminal go back to normal mode
tnoremap <Esc> <C-\><C-n>
tnoremap :q! <C-\><C-n>:q!<CR>
" ###### Terminal Function End ######    

" ###### General Vim Settings ###### 

" let mapleader="\<BS>"  

set clipboard+=unnamedplus
syntax enable
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

nnoremap <A-g> :Gvdiffsplit!<CR>
nnoremap <C-n> :nohlsearch<CR> " Clears search results by pressing CTRL+n

vnoremap J :m '>+1<CR>gv=gv
vnoremap H :m '<-2<CR>gv=gv

vnoremap <leader> p "_dP

set shortmess+=A " don't give annoying message about swap file found

" Open new split panes to right and bottom, which feels more natural than Vim’s default:
set splitbelow splitright

" Copy to clipboard
vnoremap <leader>y  "+y
nnoremap <leader>Y  "+yg_
nnoremap <leader>y  "+y
nnoremap <leader>yy  "+yy

" Paste from clipboard
nnoremap <leader>p "+p
nnoremap <leader>P "+P
vnoremap <leader>p "+p
vnoremap <leader>P "+P


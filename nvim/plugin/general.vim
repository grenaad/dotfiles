" ###### General Vim Settings ###### 
let mapleader="\<Space>"

nnoremap <silent> <leader>n :nohlsearch<CR>

vnoremap J :m '>+1<CR>gv=gv
vnoremap K :m '<-2<CR>gv=gv

vnoremap <leader>p "_dP

" Copy to clipboard
vnoremap <leader>y  "+y
nnoremap <leader>Y  "+yg_
nnoremap <leader>y  "+y
nnoremap <leader>yy  "+yy

" Paste from clipboard
nnoremap <leader>p "+p
nnoremap <leader>P "+P
" vnoremap <leader>p "+p
" vnoremap <leader>P "+P

nnoremap <M-[> :vertical resize +5<CR>
nnoremap <M-]> :vertical resize -5<CR>

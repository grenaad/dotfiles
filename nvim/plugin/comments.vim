nnoremap <C-_> :call NERDComment(0,"toggle")<CR>
vnoremap <C-_> :call NERDComment(0,"toggle")<CR>

imap <C-_> <plug>NERDCommenterInsert
" noremap prevents <plug> mappings from working (well it prevents all mappings on the right hand side, including <plug>).

" Add spaces after comment delimiters by default
let g:NERDSpaceDelims = 1

" Allow commenting and inverting empty lines (useful when commenting a region)
let g:NERDCommentEmptyLines = 1


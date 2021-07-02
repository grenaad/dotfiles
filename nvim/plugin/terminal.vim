" ###### Toggle Terminal ###### 

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
nnoremap <M-t> :call TermToggle(12)<CR>
inoremap <M-t> <Esc>:call TermToggle(12)<CR>
tnoremap <M-t> <C-\><C-n>:call TermToggle(12)<CR>


"" When in the terminal window:  Terminal go back to normal mode
"tnoremap <Esc> <C-\><C-n>
"tnoremap :q! <C-\><C-n>:q!<CR>

nnoremap <C-\><C-n> :call TermToggle(12)<CR>
inoremap <C-\><C-n> :call TermToggle(12)<CR>


" ## COC ##
	set statusline^=%{coc#status()}
	let g:coc_global_extensions = ['coc-omnisharp', 'coc-fsharp', 'coc-python', 'coc-java', 'coc-json']

	"Use `[g` and `]g` to navigate diagnostics
	nmap <silent> [g <Plug>(coc-diagnostic-prev)
	nmap <silent> ]g <Plug>(coc-diagnostic-next)

	" rename variable
	nmap <F2> <Plug>(coc-rename)

	" Remap keys for gotos
	nmap <silent> gd <Plug>(coc-definition)
	nmap <silent> gy <Plug>(coc-type-definition)
	nmap <silent> gi <Plug>(coc-implementation)
	nmap <silent> gr <Plug>(coc-references)

	" Show documentation in preview window
	nnoremap <silent> gh :call <SID>show_documentation()<CR>

	function! s:show_documentation()
	  if (index(['vim','help'], &filetype) >= 0)
	    execute 'h '.expand('<cword>')
	  else
	    call CocAction('doHover')
	  endif
	endfunction

" ## NERDTree ##
	" If another buffer tries to replace NERDTree, put it in the other window, and bring back NERDTree.
	autocmd BufEnter * if bufname('#') =~ 'NERD_tree_\d\+' && bufname('%') !~ 'NERD_tree_\d\+' && winnr('$') > 1 |
	    \ let buf=bufnr() | buffer# | execute "normal! \<C-W>w" | execute 'buffer'.buf | endif

	nnoremap <C-e> :NERDTreeFocus<CR>

" ## Git ##
" 	fzf checkout
	let g:fzf_layout = {'window': {'width': 0.8, 'height': 0.8}}
	let $FZF_DEFAULT_OPTS='--reverse'

"	fugitive
	nmap <leader>gs: Git<CR> # Git status
	nmap <leader>gf: diffget //2<CR> # use the left diff
	nmap <leader>gj: diffget //3<CR> # use the right diff

" ## FZF ##
" https://www.youtube.com/watch?v=on1AzaZzQ7k
" https://www.chrisatmachine.com/Neovim/08-fzf/
	nnoremap <C-p> :FZF<CR>


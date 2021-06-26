" ##  LSP config
" LSP config (the mappings used in the default file don't quite work right)
" default commands
" https://www.chrisatmachine.com/Neovim/27-native-lsp/

"" ## COC ##
	"set statusline^=%{coc#status()}
	"let g:coc_global_extensions = ['coc-omnisharp', 'coc-fsharp', 'coc-pyright', 'coc-java', 'coc-json', 'coc-kotlin', 'coc-groovy']

	""Use `[g` and `]g` to navigate diagnostics
	"nmap <silent> [g <Plug>(coc-diagnostic-prev)
	"nmap <silent> ]g <Plug>(coc-diagnostic-next)

	"" Use <c-space> to trigger completion.
	"inoremap <silent><expr> <c-space> coc#refresh()

	"" Use <cr> to confirm completion 
	"inoremap <expr> <cr> pumvisible() ? "\<C-y>" : "\<C-g>u\<CR>"

	"" Use <Tab> and <S-Tab> to navigate the completion list:
	"inoremap <expr> <Tab> pumvisible() ? "\<C-n>" : "\<Tab>"
	"inoremap <expr> <S-Tab> pumvisible() ? "\<C-p>" : "\<S-Tab>"

	"" rename variable
	"nmap <F2> <Plug>(coc-rename)

	"" Fix autofix problem of current line
	"nmap <F6> <Plug>(coc-fix-current)

	"" Remap for format selected region
	""nmap <F3> <Plug>(coc-format-selected)

	"" Remap for do codeAction of current line
	"nmap <C-,> <Plug>(coc-codeaction)

	"" Remap keys for gotos
	"nmap <silent> gd <Plug>(coc-definition)
	"nmap <silent> gy <Plug>(coc-type-definition)
	"nmap <silent> gi <Plug>(coc-implementation)
	"nmap <silent> gr <Plug>(coc-references)

	"" Show documentation in preview window
	"nnoremap <silent> gh :call <SID>show_documentation()<CR>

	"function! s:show_documentation()
	  "if (index(['vim','help'], &filetype) >= 0)
		"execute 'h '.expand('<cword>')
	  "else
		"call CocAction('doHover')
	  "endif
	"endfunction


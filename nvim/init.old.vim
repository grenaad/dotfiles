" #### Plugins ####
call plug#begin('~/.vim/plugged')

Plug 'neoclide/coc.nvim', {'branch': 'release'} 

" Plug 'dart-lang/dart-vim-plugin' " dart syntax, coc does the lsp

Plug 'tpope/vim-fugitive' " manage git
Plug 'idanarye/vim-merginal' " fugitive extension

Plug 'tpope/vim-surround' " Provides mappings to change surroundings in pairs.
Plug 'jiangmiao/auto-pairs' " Insert or delete brackets, parens, quotes in pair

Plug 'unblevable/quick-scope' " highlight for a character on a word in a line to jump to

Plug 'scrooloose/nerdcommenter' " Comment functions so powerful, no comment necessary.

Plug 'francoiscabrol/ranger.vim' " Use Ranger as file manager
Plug 'rbgrouleff/bclose.vim' " must have this dependency if usign neovim

Plug 'airblade/vim-rooter' " set the working directory automatically 

Plug 'itchyny/lightline.vim'
Plug 'pacha/vem-tabline' " Display buffer line on top of screen

"Plug 'flrnprz/candid.vim' " vim theme
Plug 'danilo-augusto/vim-afterglow'

" icons for Nerd Font
Plug 'ryanoasis/vim-devicons'

" Fzf vim wrapper and ripgrep
Plug 'junegunn/fzf', { 'dir': '~/.fzf', 'do': './install --all' }
Plug 'junegunn/fzf.vim'

" Markdown preview
Plug 'iamcco/markdown-preview.nvim', { 'do': { -> mkdp#util#install() }}

"Plug 'vobornik/vim-mql4' " mql4 syntax

" Plug 'heavenshell/vim-pydocstring' " Generate Python docstring 

Plug 'moll/vim-bbye' " Close vim buffers while keeping windows open

" Initialize plugin system
call plug#end()

" ------------ Plugins ------------ 
"
" Buffer Bye
	nnoremap <M-d> :Bdelete<CR>

" Vim-Merginal
	let g:merginal_windowWidth = 60
	" Limit the number of commits displayed
	let g:merginal_logCommitCount = 20

" Fugitive Conflict Resolution
" Git index: Stage: 1 -> base
"			 Stage: 2 -> ours (head)
"			 Stage: 3 -> theirs (remote)
	nnoremap gds :Gvdiffsplit!<CR>
	nnoremap gdh :diffget //2<CR> " keep left(h) changes
	nnoremap gdl :diffget //3<CR> " keep right(l) changes

" PyDocstring
"   let g:pydocstring_templates_dir = '~/.config/nvim/pydocstring_template'

" Explorer
	map <silent> <C-e> :Lexplore<CR>
	map <silent> <M-e> :Lexplore %:p:h<CR>

	let g:netrw_banner = 0
	let g:netrw_winsize = 25
	let g:netrw_list_hide = '^\./$'
	let g:netrw_hide = 1
	let g:netrw_liststyle = 3 " tree view, toggle with i for different views

" Dart
	" let g:dart_style_guide = 2 " Enable DartFmt execution on buffer save with 
	" let g:dart_style_guide = 2 " Enable Dart style guide syntax (like 2-space indentation) 
	" let dart_html_in_string=v:true " Enable HTML syntax highlighting

" ## Ranger ###
	let g:ranger_map_keys = 0 " do not use default key mapping
	map <M-e> :Ranger<CR>
	
" ## Vim Rooter ###
	" To specify how to identify a project's root directory:
	let g:rooter_patterns = ['Rakefile', 'requirements.txt', 'Cargo.toml', '.git/']
	" resolve symbolic links. To resolve links
	let g:rooter_resolve_links = 1

" ## FZF ## 
	nnoremap <C-g> :GFiles<Cr>
	nnoremap <C-f> :Files<Cr>
	nnoremap <C-s> :Rg<Cr>

    command! -bang -nargs=* Rg
      \ call fzf#vim#grep(
      \   'rg --column --line-number --no-heading --color=always --smart-case '.shellescape(<q-args>), 1,
      \   fzf#vim#with_preview(), <bang>0)

" ## Markdown preview ## 
	" do not close the preview tab when switching to other buffers
	let g:mkdp_auto_close = 0
	nnoremap <C-m> :MarkdownPreview<CR> " default browser will be opened automatically

" ## COC-Flutter ##
	nnoremap <C-b>  :CocCommand flutter.run -d chrome<CR>

" ## COC ##
	set statusline^=%{coc#status()}
	let g:coc_global_extensions = ['coc-rust-analyzer', 'coc-flutter', 'coc-python']
	"Use `[g` and `]g` to navigate diagnostics
	nmap <silent> [g <Plug>(coc-diagnostic-prev)
	nmap <silent> ]g <Plug>(coc-diagnostic-next)

	" Remap keys for gotos
	nmap <silent> gd <Plug>(coc-definition)
	nmap <silent> gy <Plug>(coc-type-definition)
	nmap <silent> gi <Plug>(coc-implementation)
	nmap <silent> gr <Plug>(coc-references)

	" Use K to show documentation in preview window
	nnoremap <silent> K :call <SID>show_documentation()<CR>

	function! s:show_documentation()
	  if (index(['vim','help'], &filetype) >= 0)
	    execute 'h '.expand('<cword>')
	  else
	    call CocAction('doHover')
	  endif
	endfunction

	" Use <c-space> to trigger completion.
	inoremap <silent><expr> <c-space> coc#refresh()

	" Use <cr> to confirm completion 
	inoremap <expr> <cr> pumvisible() ? "\<C-y>" : "\<C-g>u\<CR>"

	" Use <Tab> and <S-Tab> to navigate the completion list:
	inoremap <expr> <Tab> pumvisible() ? "\<C-n>" : "\<Tab>"
	inoremap <expr> <S-Tab> pumvisible() ? "\<C-p>" : "\<S-Tab>"
	
	" To make <cr> select the first completion item and confirm the completion when no item has been selected:
	inoremap <silent><expr> <cr> pumvisible() ? coc#_select_confirm() : "\<C-g>u\<CR>"

	" rename variable
	nmap <F2> <Plug>(coc-rename)

	" Remap for format selected region
	nmap <F3> <Plug>(coc-format-selected)

	" Remap for do codeAction of current line
	nmap <C-,> <Plug>(coc-codeaction)

	" Fix autofix problem of current line
	nmap <F6> <Plug>(coc-fix-current)

" ## Theme Plugin ## 
	colorscheme afterglow
	let g:afterglow_blackout=1
	"set background=light

" ------------ Plugins End ------------ 

" ------------ Terminal Function ------------
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
	nnoremap <A-t> :call TermToggle(12)<CR>
	inoremap <A-t> <Esc>:call TermToggle(12)<CR>
	tnoremap <A-t> <C-\><C-n>:call TermToggle(12)<CR>

	" Terminal go back to normal mode
	tnoremap <Esc> <C-\><C-n>
	tnoremap :q! <C-\><C-n>:q!<CR>
" ------------ Terminal Function End ------------    

" ###### General Vim Settings ###### 
	" Spaces & Tabs {{{
	set tabstop=4       " number of visual spaces per TAB
	set softtabstop=4   " number of spaces in tab when editing
	set shiftwidth=4    " number of spaces to use for autoindent	"the <leader> key

	let mapleader = "\<Space>"  

	set encoding=UTF-8
	
	" yank to system clipboard
	set clipboard=unnamedplus

	" Auto reload file 
	set autoread

	" Enable autocompletion for :
	set wildmode=longest,list,full

	" Jsonc comment highlight
	autocmd FileType json syntax match Comment +\/\/.\+$+

	set encoding=utf-8
	set number! relativenumber! " toggle hybrid line numbers
	syntax enable " turn on syntax highlighting

	" Open new split panes to right and bottom, which feels more natural than Vim’s default:
	set splitbelow splitright
	set shortmess+=A " don't give annoying message about swap file found
 
	" remove the clear the preview window
	"map <C-w><C-z> :ccl<CR> 
	
	" Buffers navigation
	nnoremap <C-N> :bnext<CR>
	nnoremap <C-P> :bprev<CR>

	nnoremap <leader>h :vertical resize -5<cr>
	nnoremap <leader>j :resize +5<cr>
	nnoremap <leader>k :resize -5<cr>
	noremap <leader>l :vertical resize +5<cr>
	
	noremap <leader>w :w<CR> " Save the current buffer using the leader key
	noremap <leader>e :wq<CR> " Save and exit Vim using the leader key
	noremap <leader>q :q!<CR> " Exit without saving using the leader key

	" Show the current file path in the window title
	set title
	set titlestring=%{hostname()}\ \ %F\ \ %{strftime('%Y-%m-%d\ %H:%M',getftime(expand('%')))}

	set mouse=a                 " Automatically enable mouse usage
	set mousehide               " Hide the mouse cursor while typing

	set nocompatible " Limit search to your project
	set path+=** " Search all subdirectories and recursivley when using :find or :sf
	nnoremap <esc> :noh<return><esc> " Clear search results by pressing esc


" #### Plugins ####
call plug#begin('~/.vim/plugged')

" LSP
Plug 'neovim/nvim-lspconfig' " Impelments lsp servers
Plug 'hrsh7th/nvim-compe' " Auto completion
Plug 'glepnir/lspsaga.nvim' " Pretty hovering windows
" LspInstall kotlin java python dockerfile html json vim lua bash
Plug 'kabouzeid/nvim-lspinstall' " Language Server Install 

" Text editing
Plug 'scrooloose/nerdcommenter' " Comment functions so powerful, no comment necessary.
Plug 'tpope/vim-surround' " Provides mappings to change surroundings in pairs.
"Plug 'jiangmiao/auto-pairs' " Insert or delete brackets, parens, quotes in pair

" Navigation
Plug 'airblade/vim-rooter' " set the working directory automatically 
Plug 'nvim-lua/popup.nvim'
Plug 'nvim-lua/plenary.nvim'
Plug 'nvim-telescope/telescope.nvim'
Plug 'nvim-telescope/telescope-fzy-native.nvim'
Plug 'kevinhwang91/rnvimr' " use ranger in a floating window

" Git
Plug 'tpope/vim-fugitive'
Plug 'tpope/vim-rhubarb' " Allows for Gbrowse in fugitive to open github
Plug 'shumphrey/fugitive-gitlab.vim' " Same as above but for gitlab
" Plug 'vim-airline/vim-airline' " Display git branch on bottom

" Syntax higlighting
" TSInstall python java kotlin dockerfile bash json
Plug 'nvim-treesitter/nvim-treesitter', {'do': ':TSUpdate'}  " We recommend updating the parsers on update

" Styling theme
Plug 'gruvbox-community/gruvbox'
Plug 'hoob3rt/lualine.nvim' " Display git branch on bottom
Plug 'ryanoasis/vim-devicons'  " Dev Icons for Nerd Font

call plug#end()

colorscheme gruvbox
highlight Normal guibg=None


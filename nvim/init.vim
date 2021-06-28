" #### Plugins ####
call plug#begin('~/.vim/plugged')

" LSP
Plug 'neovim/nvim-lspconfig' " impelments lsp servers
Plug 'hrsh7th/nvim-compe' " auto completion
"Plug 'glepnir/lspsaga.nvim' # pretty hovering windows

" Text editing
Plug 'scrooloose/nerdcommenter' " Comment functions so powerful, no comment necessary.
Plug 'tpope/vim-surround' " Provides mappings to change surroundings in pairs.
"Plug 'jiangmiao/auto-pairs' " Insert or delete brackets, parens, quotes in pair

" Icons for Nerd Font
Plug 'ryanoasis/vim-devicons'

" Navigation
Plug 'airblade/vim-rooter' " set the working directory automatically 
Plug 'nvim-lua/popup.nvim'
Plug 'nvim-lua/plenary.nvim'
Plug 'nvim-telescope/telescope.nvim'
Plug 'nvim-telescope/telescope-fzy-native.nvim'
Plug 'kevinhwang91/rnvimr'

" Git
Plug 'tpope/vim-fugitive'
Plug 'tpope/vim-rhubarb' " Allows for Gbrowse in fugitive to open github
Plug 'shumphrey/fugitive-gitlab.vim' " Same as above but for gitlab
Plug 'vim-airline/vim-airline' " Display git branch on bottom

" Syntax higlighting
" TSInstall python java kotlin 
Plug 'nvim-treesitter/nvim-treesitter', {'do': ':TSUpdate'}  " We recommend updating the parsers on update

" Styling theme
Plug 'gruvbox-community/gruvbox'

call plug#end()

colorscheme gruvbox
highlight Normal guibg=None



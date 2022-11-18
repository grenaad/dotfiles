-- ########### General ###########

-- After changing plugin config exit and reopen LunarVim, Run :PackerInstall :PackerCompile
lvim.builtin.alpha.active = true
lvim.builtin.terminal.active = true
lvim.builtin.nvimtree.setup.view.side = "left"
-- lvim.builtin.nvimtree.show_icons.git = 0
lvim.log.level = "warn"
lvim.format_on_save = false
-- lvim.colorscheme = "onedarker"
vim.opt.relativenumber = true
-- if you don't want all the parsers change this to a table of the ones you want
lvim.builtin.treesitter.ensure_installed = {
  "bash",
  "c",
  "javascript",
  "json",
  "lua",
  "python",
  "typescript",
  "css",
  "rust",
  "java",
  "kotlin",
  "yaml",
  "dart",
  "json"
}
lvim.builtin.treesitter.ignore_install = { "haskell" }
lvim.builtin.treesitter.highlight.enabled = true

-- ########### Additional Plugins ###########

lvim.plugins = {
  { "folke/trouble.nvim",
    cmd = "TroubleToggle",
  },
  { "udalov/kotlin-vim" }, -- Syntax for kotlin
  { -- brew install glow
    "npxbr/glow.nvim",
    ft = { "markdown" } -- markdown previewer
  },
  { "sindrets/diffview.nvim",
    event = "BufRead",
  },
  { 'TimUntersberger/neogit',
    config = function()
      require("neogit").setup({
        disable_commit_confirmation = true,
        integrations = { diffview = true }
      })
    end,
  },
  { "PhilT/vim-fsharp" }, -- Fsharp syntax and indenting
  { "ruifm/gitlinker.nvim",
    event = "BufRead",
    config = function()
      require("gitlinker").setup {
        opts = {
          -- remote = 'github', -- force the use of a specific remote
          add_current_line_on_normal_mode = true, -- adds current line nr in the url for normal mode
          action_callback = require("gitlinker.actions").copy_to_clipboard, -- callback for what to do with the url
          print_url = true, -- print the url after performing the action
          mappings = "<leader>gy", -- mapping to call url generation
        },
      }
    end,
    requires = "nvim-lua/plenary.nvim",
  },
  { "ThePrimeagen/harpoon" },
  { "meain/vim-package-info",
    run = "npm install"
  },
  {
  "windwp/nvim-ts-autotag",
  config = function()
    require("nvim-ts-autotag").setup()
  end,
},
}

vim.opt.colorcolumn = "150"
vim.cmd("set textwidth=150")
-- vim.cmd([[
--     augroup FSharp_AutoRefreshCodeLens
--         autocmd!
--         autocmd CursorHold,InsertLeave <buffer> lua vim.lsp.codelens.refresh()
--     augroup END
-- ]])

-- TODO use Octo.nvim for Github integration
-- https://github.com/pwntester/octo.nvim

-- TODO Dependency management use vim package for javascript package.json updates
-- https://github.com/meain/vim-package-info

-- Fsharp LSP
local util = require('lspconfig/util')
require 'lspconfig'.fsautocomplete.setup {
  cmd = { 'fsautocomplete', '--background-service-enabled' },
  root_dir = util.root_pattern('*.sln', '.git'),
}

require 'lspconfig'.dartls.setup {
  settings = {
    dart = {
      lineLength = 150,
      completeFunctionCalls = true,
      showTodos = true
    }
  }
}
-- autocommand are done by plugin PhilT/vim-fsharp
-- vim.cmd("au BufNewFile,BufRead *.fs,*.fsx,*.fsi set filetype=fsharp")

-- ########### Configure plugins ###########

-- ## Builtin ##

-- Appending to root dir pattern
lvim.builtin.project.patterns[#lvim.builtin.project.patterns + 1] = "*.sln"

-- Move between buffers
lvim.keys.normal_mode["<S-L>"] = ":bnext<CR>"
lvim.keys.normal_mode["<S-H>"] = ":bprev<CR>"

-- Move between quicklist items
lvim.keys.normal_mode["<C-n>"] = ":cnext<CR>"
lvim.keys.normal_mode["<C-p>"] = ":cprev<CR>"

-- ## Whichkey ##

-- Git Linker
lvim.builtin.which_key.mappings.g.y = { "<cmd>lua require('gitlinker').get_buf_range_url('n')<cr>",
  "Copy permalink to clipboard" }

-- Neogit and Diffview
lvim.builtin.which_key.mappings.g.w = { "<cmd>Neogit<cr>", "Status Window" }
lvim.builtin.which_key.mappings.g.d = { "<cmd>DiffviewOpen<cr>", "Diff view" }
lvim.builtin.which_key.mappings.g.D = { "<cmd>DiffviewOpen master<cr>", "Diff view against master" }
lvim.builtin.which_key.mappings.g.t = { "<cmd>DiffviewClose<cr>", "Close Diff view" }
lvim.builtin.which_key.mappings.g.P = lvim.builtin.which_key.mappings.g.p -- switch preview chunk with Git Push
lvim.builtin.which_key.mappings.g.p = { "<cmd>Neogit push<cr>", "Push" }

-- Telescope
lvim.builtin.which_key.mappings.s.d = { "<cmd>lua require('telescope.builtin').git_files({hidden=true, prompt_title='< VimRC >', cwd='$HOME/projects/dotfiles/',})<cr>",
  "Search dotfiles" }
lvim.builtin.which_key.mappings["F"] = lvim.builtin.which_key.mappings["f"]
lvim.builtin.which_key.mappings["f"] = { "<cmd>lua require('telescope.builtin').git_files({hidden=true})<cr>",
  "Find all files" }

-- Trouble
-- jump to the previous item, skipping the groups
lvim.keys.normal_mode["<C-]>"] = ":lua require('trouble').previous({skip_groups = true, jump = true})<cr>"
-- jump to the next item, skipping the groups
lvim.keys.normal_mode["<C-[>"] = ":lua require('trouble').next({skip_groups = true, jump = true})<cr>"

lvim.builtin.which_key.mappings.t = { -- Trouble, jump to lsp error diagnostics
  name = "Diagnostics",
  t = { "<cmd>TroubleToggle<cr>", "Trouble" },
}

-- Markdown
lvim.builtin.which_key.mappings.m = { "<cmd>Glow<cr>", "View Markdown files" }

-- Harpoon

lvim.builtin.which_key.mappings.n = {
  name = "Harpoon",
  m = { "<cmd>lua require('harpoon.ui').toggle_quick_menu()<cr>", "Quick Menu" },
  a = { "<cmd>lua require('harpoon.mark').add_file()<cr>", "Add File" },
  n = { "<cmd>lua require('harpoon.ui').nav_next()<cr>", "Next"},
  p = { "<cmd>lua require('harpoon.ui').nav_prev()<cr>", "Previous"},
  j = { "<cmd>lua require('harpoon.ui').nav_file(1)<cr>", "File 1"},
  k = { "<cmd>lua require('harpoon.ui').nav_file(2)<cr>", "File 2"},
  l = { "<cmd>lua require('harpoon.ui').nav_file(3)<cr>", "File 3"},
}

-- Nvim-tree
lvim.builtin.nvimtree.hide_dotfiles = false

-- ########### Keymappings  ###########

lvim.leader = "space"
lvim.keys.normal_mode["<C-s>"] = ":w<cr>" -- save file
lvim.keys.normal_mode["<C-z>"] = ":q<cr>" -- override suspend of vim, rather just quit
vim.cmd("vnoremap <leader>P \"_dP") -- when pasting, move the word to the _ register (delete it), and paste
-- vim.cmd("nnoremap gf :edit <cfile><cr>") -- Allows gf to open non existing files



-- ########### General ###########

-- After changing plugin config exit and reopen LunarVim, Run :PackerInstall :PackerCompile
lvim.builtin.dashboard.active = true
lvim.builtin.terminal.active = true
lvim.builtin.nvimtree.setup.view.side = "left"
lvim.builtin.nvimtree.show_icons.git = 0
lvim.log.level = "warn"
lvim.format_on_save = true
lvim.colorscheme = "onedarker"
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
}
lvim.builtin.treesitter.ignore_install = { "haskell" }
lvim.builtin.treesitter.highlight.enabled = true

-- ########### Additional Plugins ###########

lvim.plugins = {
    {"folke/trouble.nvim",
      cmd = "TroubleToggle",
    },
    {"udalov/kotlin-vim"}, -- Syntax for kotlin
    { -- brew install glow
     "npxbr/glow.nvim",
     ft = {"markdown"} -- markdown previewer
    },
    {"sindrets/diffview.nvim",
      event = "BufRead",
    },
    {'TimUntersberger/neogit',
      config = function ()
        require("neogit").setup ({
          disable_commit_confirmation = true,
          integrations = { diffview = true }
        })
      end,
    },
    { -- brew install gnu-sed
    "windwp/nvim-spectre",
      event = "BufRead",
      config = function()
        require("spectre").setup()
      end,
    },
    {"PhilT/vim-fsharp"}, -- Fsharp syntax and indenting
    {"ruifm/gitlinker.nvim",
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
    {"ggandor/lightspeed.nvim",
      event = "BufRead",
      -- vim.cmd("unmap s | unmap S") -- or unmap f | unmap F | unmap t | unmap T
    },
    {"kevinhwang91/nvim-bqf",
      event = { "BufRead", "BufNew" },
      config = function()
        require("bqf").setup({
          auto_enable = true,
          preview = {
            win_height = 12,
            win_vheight = 12,
            delay_syntax = 80,
            border_chars = { "┃", "┃", "━", "━", "┏", "┓", "┗", "┛", "█" },
          },
          func_map = {
            vsplit = "",
            ptogglemode = "z,",
            stoggleup = "",
          },
          filter = {
            fzf = {
              action_for = { ["ctrl-s"] = "split" },
              extra_opts = { "--bind", "ctrl-o:toggle-all", "--prompt", "> " },
            },
          },
         })
      end,
      },
      {"ThePrimeagen/harpoon"},
      {"meain/vim-package-info",
        run ="npm install"
      }
}

vim.cmd("set textwidth=100") 
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
require'lspconfig'.fsautocomplete.setup{
    cmd = {'fsautocomplete', '--background-service-enabled' },
    root_dir = util.root_pattern('*.sln', '.git'),
}
-- autocommand are done by plugin PhilT/vim-fsharp
-- vim.cmd("au BufNewFile,BufRead *.fs,*.fsx,*.fsi set filetype=fsharp")

-- ########### Configure plugins ###########

-- ## Builtin ##

    -- Appending to root dir pattern
lvim.builtin.project.patterns[#lvim.builtin.project.patterns+1]="*.sln"

    -- LSP, was copied from lvim configs, these mappings are not loaded with lvim for some reason
lvim.keys.normal_mode["K"]  = ":lua vim.lsp.buf.hover()<cr>"
lvim.keys.normal_mode["gd"] = ":lua vim.lsp.buf.definition()<cr>"
lvim.keys.normal_mode["gD"] = ":lua vim.lsp.buf.declaration()<cr>"
lvim.keys.normal_mode["gr"] = ":lua vim.lsp.buf.references()<cr>"
lvim.keys.normal_mode["gI"] = ":lua vim.lsp.buf.implementation()<cr>"
lvim.keys.normal_mode["gs"] = ":lua vim.lsp.buf.signature_help()<cr>"
lvim.keys.normal_mode["gp"] = ":lua require'lvim.lsp.peek'.Peek('definition')<cr>"
lvim.keys.normal_mode["gl"] = ":lua require'lvim.lsp.handlers'.show_line_diagnostics()<cr>"

-- ## Whichkey ##

-- Git Linker
lvim.builtin.which_key.mappings.g.y = { "<cmd>lua require('gitlinker').get_buf_range_url('n')<cr>", "Copy permalink to clipboard" }

-- Neogit and Diffview
lvim.builtin.which_key.mappings.g.w = { "<cmd>Neogit<cr>", "Status Window" }
lvim.builtin.which_key.mappings.g.d = { "<cmd>DiffviewOpen<cr>", "Diff view" }
lvim.builtin.which_key.mappings.g.D = { "<cmd>DiffviewOpen master<cr>", "Diff view against master" }
lvim.builtin.which_key.mappings.g.t = { "<cmd>DiffviewClose<cr>", "Close Diff view" }
lvim.builtin.which_key.mappings.g.P = lvim.builtin.which_key.mappings.g.p -- switch preview chunk with Git Push
lvim.builtin.which_key.mappings.g.p = { "<cmd>Neogit push<cr>", "Push" }

-- Telescope
lvim.builtin.which_key.mappings.s.d = { "<cmd>lua require('telescope.builtin').git_files({hidden=true, prompt_title='< VimRC >', cwd='$HOME/projects/dotfiles/',})<cr>", "Search dotfiles" }
lvim.builtin.which_key.mappings["F"] = lvim.builtin.which_key.mappings["f"]
lvim.builtin.which_key.mappings["f"] = { "<cmd>lua require('telescope.builtin').git_files({hidden=true})<cr>", "Find all files" }

-- Spectre, Search and replace
lvim.builtin.which_key.mappings["r"] = {
    name = "Replace",
    r = { "<cmd>lua require('spectre').open()<cr>", "Replace" },
    w = { "<cmd>lua require('spectre').open_visual({select_word=true})<cr>", "Replace current word" },
    f = { "<cmd>lua require('spectre').open_file_search()<cr>", "Replace in current buffer only" },
}

-- Trouble

-- jump to the previous item, skipping the groups
lvim.keys.normal_mode["<C-]>"] = ":lua require('trouble').previous({skip_groups = true, jump = true})<cr>"
-- jump to the next item, skipping the groups
lvim.keys.normal_mode["<C-[>"] = ":lua require('trouble').next({skip_groups = true, jump = true})<cr>"

lvim.builtin.which_key.mappings.t = { -- Trouble, jump to lsp error diagnostics
    name = "Diagnostics",
    t = { "<cmd>TroubleToggle<cr>", "Trouble" },
    w = { "<cmd>TroubleToggle lsp_workspace_diagnostics<cr>", "Workspace" },
    d = { "<cmd>TroubleToggle lsp_document_diagnostics<cr>", "Document" },
    q = { "<cmd>TroubleToggle quickfix<cr>", "Quickfix" },
    l = { "<cmd>TroubleToggle loclist<cr>", "Loclist" },
    r = { "<cmd>TroubleToggle lsp_references<cr>", "References" },
}

-- Markdown
lvim.builtin.which_key.mappings.m = { "<cmd>Glow<cr>", "View Markdown files" }

-- Harpoon
lvim.builtin.which_key.mappings.n = {
    name = "Harpoon",
    m = { "<cmd>lua require('harpoon.ui').toggle_quick_menu()<cr>", "Quick Menu" },
    a = { "<cmd>lua require('harpoon.mark').add_file()<cr>", "Add File" },
}
lvim.keys.normal_mode["<C-n>"] = ":lua require('harpoon.ui').nav_next()<cr>"
lvim.keys.normal_mode["<C-p>"] = ":lua require('harpoon.ui').nav_prev()<cr>"
lvim.keys.normal_mode["<C-y>"] = ":lua require('harpoon.ui').nav_file(1)<cr>"
lvim.keys.normal_mode["<C-n>"] = ":lua require('harpoon.ui').nav_file(2)<cr>"
lvim.keys.normal_mode["<C-m>"] = ":lua require('harpoon.ui').nav_file(3)<cr>"

-- Lightspeed
lvim.keys.normal_mode["<C-S>"] = ":<Plug>Lightspeed_S<enter>"
lvim.keys.normal_mode["<C-s>"] = ":<Plug>Lightspeed_s<enter>"

-- Nvim-tree
lvim.builtin.nvimtree.hide_dotfiles = false

-- ########### Keymappings  ###########

lvim.leader = "space"
lvim.keys.normal_mode["<C-s>"] = ":w<cr>" -- save file
lvim.keys.normal_mode["<C-z>"] = ":q<cr>" -- override suspend of vim, rather just quit
vim.cmd("nnoremap gf :edit <cfile><cr>") -- Allows gf to open non existing files


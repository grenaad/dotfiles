-- ########### General ###########
lvim.colorscheme = "desert"
-- After changing plugin config exit and reopen LunarVim, Run :PackerInstall :PackerCompile
lvim.builtin.alpha.active = true
lvim.builtin.terminal.active = true
lvim.builtin.nvimtree.setup.view.side = "left"

-- Telescope Settings, override defaults
lvim.builtin.telescope.defaults.layout_strategy = "flex" -- change layout_strategy giving size
lvim.builtin.telescope.defaults.prompt_prefix = "  "
lvim.builtin.telescope.defaults.layout_config = {
  -- prompt_position = "top",
  height = 0.9,
  width = 0.9,
  bottom_pane = {
    height = 25,
    preview_cutoff = 120,
  },
  center = {
    height = 0.4,
    preview_cutoff = 40,
    width = 0.5,
  },
  cursor = {
    preview_cutoff = 40,
  },
  horizontal = {
    preview_cutoff = 120,
    preview_width = 0.6,
  },
  vertical = {
    preview_cutoff = 40,
  },
  flex = {
    flip_columns = 150,
  },
}

lvim.builtin.telescope.pickers = {
  find_files = {
    layout_config = {
      width = 0.95,
    },
  },
  live_grep = {
    layout_config = {
      width = 0.95,
    },
  },
}

-- lvim.builtin.nvimtree.show_icons.git = 0
  --
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
lvim.builtin.nvimtree.setup.view.adaptive_size = true

-- ########### Additional Plugins ###########

lvim.plugins = {
  {
    "kevinhwang91/rnvimr",
    cmd = "RnvimrToggle",
    config = function()
      vim.g.rnvimr_draw_border = 1
      vim.g.rnvimr_pick_enable = 1
      vim.g.rnvimr_bw_enable = 1
    end,
  },
  {
    -- Pretty Quick fix window with preview
    "kevinhwang91/nvim-bqf",
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
  { "folke/trouble.nvim",
    cmd = "TroubleToggle",
    config = function()
      require("trouble").setup({
        auto_preview = false
      })
    end
  },
  { "udalov/kotlin-vim" }, -- Syntax for kotlin
  { "iamcco/markdown-preview.nvim", -- markdown previewer
    build = "cd app && npm install",
    ft = "markdown",
    config = function()
      vim.g.mkdp_auto_start = 1
    end,
  },
  { "sindrets/diffview.nvim",
    event = "BufRead",
  },
  { 'kdheepak/lazygit.nvim' },
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
    dependencies = "nvim-lua/plenary.nvim",
  },
  { "ThePrimeagen/harpoon" },
  { "ThePrimeagen/vim-be-good" },
  { "vuki656/package-info.nvim"}, -- check package.json for latest versions of packges
  { "ionide/Ionide-vim"},
}

vim.opt.colorcolumn = "120"
-- vim.cmd("set textwidth=150")

-- TODO use Octo.nvim for Github integration
-- https://github.com/pwntester/octo.nvim

require 'lspconfig'.dartls.setup {
  settings = {
    dart = {
      lineLength = 150,
      completeFunctionCalls = true,
      showTodos = true
    }
  }
}

-- autocommand set Metatrader file types
vim.cmd("au BufNewFile,BufRead *.mqh,*.mq4,*.mq5 set filetype=cpp")

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

-- Telescope
lvim.builtin.which_key.mappings.s.w = {
  "<cmd>lua require('telescope.builtin').grep_string({ search = vim.fn.expand('<cword>') })<cr>",
  "Search Word Under Cursor" }
lvim.builtin.which_key.mappings.s.d = { "<cmd>lua require('telescope.builtin').git_files({hidden=true, prompt_title='< VimRC >', cwd='$HOME/projects/dotfiles/',})<cr>",
  "Search Dotfiles" }
lvim.builtin.which_key.mappings.s.P = lvim.builtin.which_key.mappings.s.p
lvim.builtin.which_key.mappings.s.p = { "<cmd>lua require('telescope.builtin').grep_string({ search = vim.fn.input('Grep > ') })<cr>",
  "Search Project" }
lvim.builtin.which_key.mappings["F"] = lvim.builtin.which_key.mappings["f"]
lvim.builtin.which_key.mappings["f"] = { "<cmd>lua require('telescope.builtin').git_files({hidden=true})<cr>",
  "Find all files" }

-- Trouble
-- jump to the previous item, skipping the groups
lvim.keys.normal_mode["<C-[>"] = ":lua require('trouble').previous({skip_groups = true, jump = true})<cr>"
-- jump to the next item, skipping the groups
lvim.keys.normal_mode["<C-]>"] = ":lua require('trouble').next({skip_groups = true, jump = true})<cr>"

-- Trouble, jump to lsp error diagnostics
lvim.builtin.which_key.mappings["t"] = {
  name = "Diagnostics",
  t = { "<cmd>TroubleToggle<cr>", "trouble" },
  w = { "<cmd>TroubleToggle workspace_diagnostics<cr>", "workspace" },
  d = { "<cmd>TroubleToggle document_diagnostics<cr>", "document" },
  q = { "<cmd>TroubleToggle quickfix<cr>", "quickfix" },
  l = { "<cmd>TroubleToggle loclist<cr>", "loclist" },
  r = { "<cmd>TroubleToggle lsp_references<cr>", "references" },
}

-- Ranger
lvim.builtin.which_key.mappings.r = {
  name = "Ranger",
  r = { "<cmd>RnvimrToggle<cr>", "Show Ranger in floating window" },
}

-- Markdown
lvim.builtin.which_key.mappings.m = {
  name = "Markdown",
  m = { "<cmd>MarkdownPreview<cr>", "Preview Markdown file" },
  s = { "<cmd>MarkdownPreviewStop<cr>", "Stop Preview" },
  t = { "<cmd>MarkdownPreviewToggle<cr>", "Toggle Preview" },
}

-- Harpoon
lvim.builtin.which_key.mappings.n = { -- Navigation
  name = "Harpoon",
  m = { "<cmd>lua require('harpoon.ui').toggle_quick_menu()<cr>", "Quick Menu" },
  a = { "<cmd>lua require('harpoon.mark').add_file()<cr>", "Add File" },
  n = { "<cmd>lua require('harpoon.ui').nav_next()<cr>", "Next" },
  p = { "<cmd>lua require('harpoon.ui').nav_prev()<cr>", "Previous" },
  j = { "<cmd>lua require('harpoon.ui').nav_file(1)<cr>", "File 1" },
  k = { "<cmd>lua require('harpoon.ui').nav_file(2)<cr>", "File 2" },
  l = { "<cmd>lua require('harpoon.ui').nav_file(3)<cr>", "File 3" },
}

-- Nvim-tree
lvim.builtin.nvimtree.hide_dotfiles = false

-- ########### Keymappings  ###########

lvim.leader = "space"
lvim.keys.normal_mode["<C-s>"] = ":w<cr>" -- save file
lvim.keys.normal_mode["<C-z>"] = ":q<cr>" -- override suspend of vim, rather just quit
-- vim.cmd('vnoremap <C-p> "_dP') -- when pasting, move the word to the _ register (delete it), and paste
-- vim.cmd("nnoremap gf :edit <cfile><cr>") -- Allows gf to open non existing files

lvim.keys.normal_mode["gR"] = "<cmd>Telescope lsp_references<CR>"
lvim.keys.normal_mode["ge"] = function() vim.diagnostic.open_float() end

-- vim.cmd("nnoremap gr :Telescope lsp_references<cr>")

-- ########### General ###########

-- vim.cmd("set textwidth=150")
-- lvim.colorscheme = "desert"
lvim.colorscheme = "tokyonight-night"
vim.opt.colorcolumn = "120"
lvim.builtin.alpha.active = true
lvim.builtin.terminal.active = true
lvim.builtin.nvimtree.setup.view.side = "left"

vim.cmd([[autocmd FileType markdown set tw=80 wrap]])

-- lvim.builtin.nvimtree.show_icons.git = 0
--
lvim.log.level = "warn"
lvim.format_on_save = false
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
  "json",
}
lvim.builtin.treesitter.ignore_install = { "haskell" }
lvim.builtin.treesitter.highlight.enabled = true
lvim.builtin.nvimtree.setup.view.adaptive_size = true

-- ########### Additional Plugins ###########

-- java: https://medium.com/@chrisatmachine/lunarvim-as-a-java-ide-da65c4a77fb4
-- disable the builtin jdtls support, nvim-jdtls will be used
vim.list_extend(lvim.lsp.automatic_configuration.skipped_servers, { "jdtls" })

lvim.plugins = {
  {
    -- TODO: settings are in ftplugin/java.lua, need to setup first
    "mfussenegger/nvim-jdtls",
  },
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
  {
    "folke/trouble.nvim",
    cmd = "TroubleToggle",
    config = function()
      require("trouble").setup({
        auto_preview = false,
      })
    end,
  },
  -- { "udalov/kotlin-vim" },          -- Syntax for kotlin
  {
    "iamcco/markdown-preview.nvim", -- markdown previewer
    build = "cd app && npm install",
    ft = "markdown",
    config = function()
      vim.g.mkdp_auto_start = 1
    end,
  },
  {
    "sindrets/diffview.nvim",
    event = "BufRead",
  },
  { "kdheepak/lazygit.nvim" },
  {
    "ruifm/gitlinker.nvim",
    event = "BufRead",
    config = function()
      require("gitlinker").setup({
        opts = {
          add_current_line_on_normal_mode = true,                      -- adds current line nr in the url for normal mode
          action_callback = require("gitlinker.actions").copy_to_clipboard, -- callback for what to do with the url
          print_url = true,                                            -- print the url after performing the action
          mappings = "<leader>gy",                                     -- mapping to call url generation
        },
      })
    end,
    dependencies = "nvim-lua/plenary.nvim",
  },
  { "ThePrimeagen/harpoon" },
  { "ThePrimeagen/vim-be-good" },
  { "vuki656/package-info.nvim" }, -- check package.json for latest versions of packges
  { "ionide/Ionide-vim" },
}

-- TODO use Octo.nvim for Github integration
-- https://github.com/pwntester/octo.nvim

local lspconfig = require("lspconfig")

lspconfig.gleam.setup({})

-- require("mason-lspconfig").setup_handlers {
--   ["gleam"] = function()
--     local lspconfig = require("lspconfig")
--     lspconfig.gleam.setup({})
--   end
-- }

lspconfig.dartls.setup({
  settings = {
    dart = {
      lineLength = 150,
      completeFunctionCalls = true,
      showTodos = true,
    },
  },
})

-- Hoos into LSP to extend it with external apps
-- local null_ls = require("null-ls")
-- used to be  null_ls .setup()
-- sources = {
--   -- Lua
--   null_ls.builtins.formatting.stylua,

--   -- Python
--   null_ls.builtins.formatting.black,
--   null_ls.builtins.formatting.isort.with({ extra_args = { "--profile", "black" } }),
--   null_ls.builtins.diagnostics.pylint.with({
--     extra_args = {
--       "--disable=R0801,W1508,C0114,C0115,C0116,C0301,W0611,W1309,C0103,W0201,E0401",
--     },
--     diagnostics_postprocess = function(diagnostic)
--       diagnostic.code = diagnostic.message_id
--     end,
--   }),
--   null_ls.builtins.diagnostics.flake8.with({
--     extra_args = {
--       "--extend-ignore=E302,E501,D107,D105,W503,E203,D100,D103,F401",
--     },
--   }),
-- }

-- table.insert(lvim.lsp.null_ls.config.sources, sources)

-- autocommand set Metatrader file types
vim.cmd("au BufNewFile,BufRead *.mqh,*.mq4,*.mq5 set filetype=cpp")

vim.cmd("au BufNewFile,BufRead *.js set filetype=typescript")

-- To have html and tailwind lsp, change the file type for temple files to html
vim.filetype.add({ extension = { templ = "html" } })
-- Then add html to templ as filetype to use.
lspconfig.templ.setup({
  filetypes = {
    "templ",
    "html",
  },
})

-- dotfiles file types
vim.cmd("au BufNewFile,BufRead *.functions,*.aliases set filetype=bash")
-- ########### Configure plugins ###########

-- ## Builtin ##

-- Appending to root dir pattern
lvim.builtin.project.patterns[#lvim.builtin.project.patterns + 1] = "*.sln"
lvim.builtin.project.patterns[#lvim.builtin.project.patterns + 1] = "go.mod"

-- Move between buffers
lvim.keys.normal_mode["<S-L>"] = ":bnext<CR>"
lvim.keys.normal_mode["<S-H>"] = ":bprev<CR>"

-- Move between quicklist items
vim.keymap.set("n", "<C-k>", "<cmd>cnext<CR>zz")
vim.keymap.set("n", "<C-j>", "<cmd>cprev<CR>zz")

-- Move visualy selected line up or down
vim.keymap.set("v", "J", ":m '>+1<CR>gv=gv")
vim.keymap.set("v", "K", ":m '<-2<CR>gv=gv")
-- ## Whichkey ##

-- Git Linker
lvim.builtin.which_key.mappings.g.y =
{ "<cmd>lua require('gitlinker').get_buf_range_url('n')<cr>", "Copy permalink to clipboard" }

-- Telescope
lvim.builtin.which_key.mappings.s.w = {
  "<cmd>lua require('telescope.builtin').grep_string({ search = vim.fn.expand('<cword>') })<cr>",
  "Search Word Under Cursor",
}
lvim.builtin.which_key.mappings.s.d = {
  "<cmd>lua require('telescope.builtin').git_files({hidden=true, prompt_title='< VimRC >', cwd='$HOME/projects/dotfiles/',})<cr>",
  "Search Dotfiles",
}
lvim.builtin.which_key.mappings.s.P = lvim.builtin.which_key.mappings.s.p
lvim.builtin.which_key.mappings.s.p = {
  "<cmd>lua require('telescope.builtin').grep_string({ search = vim.fn.input('Grep > ') })<cr>",
  "Search Project",
}
lvim.builtin.which_key.mappings["F"] = lvim.builtin.which_key.mappings["f"]
lvim.builtin.which_key.mappings["f"] =
{ "<cmd>lua require('telescope.builtin').git_files({hidden=true})<cr>", "Find all files" }

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
-- lvim.builtin.which_key.mappings.r = {
--   name = "Ranger",
--   r = { "<cmd>RnvimrToggle<cr>", "Show Ranger in floating window" },
-- }

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

-- Telescope
lvim.builtin.telescope.defaults.layout_strategy = "flex" -- change layout_strategy giving size
lvim.builtin.telescope.defaults.prompt_prefix = "  "
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

-- Ionide-vim / fsautocomplete
-- sending the signature after every cursor move, restarts codelens, causing codelens to flicker
-- only refresh when text has changed
vim.g["fsharp#show_signature_on_cursor_move"] = 0
vim.g["fsharp#lsp_codelens"] = 0
lvim.autocommands = {
  {
    { "WinEnter" },
    {
      pattern = { "*.fs", "*.fsx", "*.fsi" },
      callback = vim.lsp.codelens.refresh,
      group = "fhsarp_codelens",
    },
  },
}

lvim.autocommands = {
  {
    { "TextChanged" },
    {
      pattern = { "*.fs", "*.fsx", "*.fsi" },
      callback = vim.lsp.codelens.refresh,
      group = "fhsarp_codelens",
    },
  },
}
-- ########### Keymappings  ###########

lvim.leader = "space"
lvim.keys.normal_mode["<C-s>"] = ":w<cr>" -- save file
lvim.keys.normal_mode["<C-z>"] = ":q<cr>" -- override suspend of vim, rather just quit
-- vim.cmd('vnoremap <C-p> "_dP') -- when pasting, move the word to the _ register (delete it), and paste
-- vim.cmd("nnoremap gf :edit <cfile><cr>") -- Allows gf to open non existing files
-- lvim.lsp.buffer_mappings.normal_mode.gD["2"] = "Goto Declaration"

lvim.keys.normal_mode["gR"] = "<cmd>Telescope lsp_references<CR>"

-- vim.cmd("nnoremap gr :Telescope lsp_references<cr>")

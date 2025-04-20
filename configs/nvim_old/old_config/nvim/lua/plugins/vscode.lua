-- don't do anything in non-vscode instances
if not vim.g.vscode then
  return {}
end

-- a list of known working plugins with vscode-neovim, update with your own plugins
local plugins = {
  "lazy.nvim",
  "AstroNvim",
  "astrocore",
  "astroui",
  "Comment.nvim",
  "nvim-autopairs",
  "nvim-treesitter",
  "nvim-ts-autotag",
  "nvim-treesitter-textobjects",
  "nvim-ts-context-commentstring",
}

local Config = require("lazy.core.config")
-- disable plugin update checking
Config.options.checker.enabled = false
Config.options.change_detection.enabled = false
-- replace the default `cond`
Config.options.defaults.cond = function(plugin)
  return vim.tbl_contains(plugins, plugin.name)
end

print("running vscode plugin")

vim.g.mapleader = " "
vim.g.maplocalleader = " "
-- unmap space to prevent it from moving forward in normal mode
vim.keymap.set('', '<Space>', '<Nop>', { noremap = true, silent = true })

vim.opt.clipboard="unnamed,unnamedplus"

---@type LazySpec
return {
  -- add a few keybindings
  {
    "AstroNvim/astrocore",
    ---@type AstroCoreOpts
    opts = {
      mappings = {

        x = {
          -- commentLine
          ["<Leader-/>"] = "<CMD>call VSCodeNotify('editor.action.addCommentLine')<CR>",

          ["<Space>"] = "<CMD>call VSCodeNotify('whichkey.show')<CR>",

          -- " Format
          ["<Leader>lf"] = "<CMD>call VSCodeNotify('editor.action.formatSelection')<CR>",

          -- " Better Navigation
          ["<C-j>"] = "<CMD>call VSCodeNotify('workbench.action.navigateDown')<CR>",
          ["<C-k>"] = "<CMD>call VSCodeNotify('workbench.action.navigateUp')<CR>",
          ["<C-h>"] = "<CMD>call VSCodeNotify('workbench.action.navigateLeft')<CR>",
          ["<C-l>"] = "<CMD>call VSCodeNotify('workbench.action.navigateRight')<CR>",
        },

        v = {
          -- " Format
          ["<Leader>lf"] = "<CMD>call VSCodeNotify('editor.action.formatSelection')<CR>",
        },

        n = {
          -- Find in files for word under cursor
          ["<Leader>fc"] = "<Cmd>lua require('vscode').action('workbench.action.findInFiles', { args = { query = vim.fn.expand('<cword>') } })<CR>",

          -- Find Files in project
          ["<Leader>fW"] = "<CMD>call VSCodeNotify('workbench.action.findInFiles')<CR>",

          -- CommentLine
          ["<Leader-/>"] = "<CMD>call VSCodeNotify('editor.action.commentLine')<CR>",

          -- Find files
          ["<Leader>ff"] = "<CMD>Find<CR>",

          ["<Leader>c"] = "<CMD>call VSCodeNotify('workbench.action.closeActiveEditor')<CR>",

           -- " Whichkey
          ["<Space>"] = "<CMD>call VSCodeNotify('whichkey.show')<CR>",

          -- " Terminal
          ["<Leader>tt"] = "<CMD>call VSCodeNotify('workbench.action.togglePanel')<CR>",
          ["<Leader>tf"] = "<CMD>call VSCodeNotify('terminal.focus')<CR>",
          ["<Leader>tn"] = "<CMD>call VSCodeNotify('workbench.action.terminal.new')<CR>",

          -- " Format
          ["<Leader>lf"] = "<CMD>call VSCodeNotify('editor.action.formatDocument')<CR>",

          -- " Better Navigation
          ["<C-j>"] = "<CMD>call VSCodeNotify('workbench.action.navigateDown')<CR>",
          ["<C-k>"] = "<CMD>call VSCodeNotify('workbench.action.navigateUp')<CR>",
          ["<C-h>"] = "<CMD>call VSCodeNotify('workbench.action.navigateLeft')<CR>",
          ["<C-l>"] = "<CMD>call VSCodeNotify('workbench.action.navigateRight')<CR>",

          -- nnoremap <silent> <C-w>_ :<C-u>call VSCodeNotify('workbench.action.toggleEditorWidths')<CR>
        },
      },
    },
  },
  -- disable colorscheme setting
  { "AstroNvim/astroui", opts = { colorscheme = false } },
  -- disable treesitter highlighting
  {
    "nvim-treesitter/nvim-treesitter",
    opts = { highlight = { enable = false } },
  },
}

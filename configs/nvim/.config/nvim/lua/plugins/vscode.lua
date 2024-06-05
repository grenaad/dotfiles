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

print(":fdfdfd  runniung vscode pluing")

vim.g.mapleader = " "
vim.g.maplocalleader = " "
-- unmap space
vim.keymap.set('', '<Space>', '<Nop>', { noremap = true, silent = true })

-- vim.cmd("set clipboard+=unnamedplus")
-- vim.opt.clipboard:append { 'unnamed', 'unnamedplus' }
-- vim.cmd("set clipboard+=unnamedplus")
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
          -- vscode commentary
          ["<Leader-/>"] = "<CMD>call VSCodeNotify('editor.action.addCommentLine')<CR>",
        },
        n = {
          -- vscode commentary
          ["<Leader-/>"] = "<CMD>call VSCodeNotify('editor.action.commentLine')<CR>",

          ["<Leader>ff"] = "<CMD>Find<CR>",
          ["<Leader>fw"] = "<CMD>call VSCodeNotify('workbench.action.findInFiles')<CR>",
          ["<Leader>ls"] = "<CMD>call VSCodeNotify('workbench.action.gotoSymbol')<CR>",

          ["<Tab>"]  = "<CMD>Tabnext<CR>",
          ["<S-Tab>"] = "<CMD>Tabprev<CR>",

          ["<S-L>"] = "<CMD>Tabnext<CR>",
          ["<S-H>"] = "<CMD>Tabprev<CR>",

-- xnoremap = <Cmd>lua require('vscode').call('editor.action.formatSelection')<CR>
-- nnoremap = <Cmd>lua require('vscode').call('editor.action.formatSelection')<CR><Esc>
-- nnoremap == <Cmd>lua require('vscode').call('editor.action.formatSelection')<CR>
          --
-- " Better Navigation
-- nnoremap <silent> <C-j> :call VSCodeNotify('workbench.action.navigateDown')<CR>
-- xnoremap <silent> <C-j> :call VSCodeNotify('workbench.action.navigateDown')<CR>
-- nnoremap <silent> <C-k> :call VSCodeNotify('workbench.action.navigateUp')<CR>
-- xnoremap <silent> <C-k> :call VSCodeNotify('workbench.action.navigateUp')<CR>
-- nnoremap <silent> <C-h> :call VSCodeNotify('workbench.action.navigateLeft')<CR>
-- xnoremap <silent> <C-h> :call VSCodeNotify('workbench.action.navigateLeft')<CR>
-- nnoremap <silent> <C-l> :call VSCodeNotify('workbench.action.navigateRight')<CR>
-- xnoremap <silent> <C-l> :call VSCodeNotify('workbench.action.navigateRight')<CR>
--
--
-- nnoremap <silent> <C-w>_ :<C-u>call VSCodeNotify('workbench.action.toggleEditorWidths')<CR>
--
-- nnoremap <silent> <Space> :call VSCodeNotify('whichkey.show')<CR>
-- xnoremap <silent> <Space> :call VSCodeNotify('whichkey.show')<CR>
--
-- " Tabs
-- nnoremap <leader>1  :call VSCodeNotify('workbench.action.openEditorAtIndex1')<CR>
-- nnoremap <leader>2  :call VSCodeNotify('workbench.action.openEditorAtIndex2')<CR>
-- nnoremap <leader>3  :call VSCodeNotify('workbench.action.openEditorAtIndex3')<CR>
-- nnoremap <leader>4  :call VSCodeNotify('workbench.action.openEditorAtIndex4')<CR>
-- nnoremap <leader>5  :call VSCodeNotify('workbench.action.openEditorAtIndex5')<CR>
-- nnoremap <leader>6  :call VSCodeNotify('workbench.action.openEditorAtIndex6')<CR>
-- nnoremap <leader>7  :call VSCodeNotify('workbench.action.openEditorAtIndex7')<CR>
-- nnoremap <leader>8  :call VSCodeNotify('workbench.action.openEditorAtIndex8')<CR>
-- nnoremap <leader>9  :call VSCodeNotify('workbench.action.openEditorAtIndex9')<CR>
--
-- " Terminal
-- nnoremap <leader>tt  :call VSCodeNotify('workbench.action.togglePanel')<CR>
-- nnoremap <leader>tf  :call VSCodeNotify('terminal.focus')<CR>
-- nnoremap <leader>tn  :call VSCodeNotify('workbench.action.terminal.new')<CR>
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

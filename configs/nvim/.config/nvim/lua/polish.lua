-- if true then return end -- WARN: REMOVE THIS LINE TO ACTIVATE THIS FILE

-- This will run last in the setup process and is a good place to configure
-- things like custom filetypes. This just pure lua so anything that doesn't
-- fit in the normal config locations above can go here
--

-- Navigate buffer tabs with `H` and `L`
vim.keymap.set("n", "<S-L>", function() require('astrocore.buffer').nav(vim.v.count1) end)
vim.keymap.set("n", "<S-H>", function() require('astrocore.buffer').nav(-vim.v.count1) end)

-- Move between quicklist items
vim.keymap.set("n", "<C-n>", "<cmd>cnext<CR>zz")
vim.keymap.set("n", "<C-p>", "<cmd>cprev<CR>zz")

-- Move visualy selected line up or down
vim.keymap.set("v", "J", ":m '>+1<CR>gv=gv")
vim.keymap.set("v", "K", ":m '<-2<CR>gv=gv")
-- ## Whichkey ##

if not vim.g.vscode then
  -- This module also loads when using vscode launches.
  require("lspconfig").gleam.setup({})
end

-- Set up custom filetypes
vim.filetype.add {
  extension = {
    foo = "fooscript",
  },
  filename = {
    ["Foofile"] = "fooscript",
  },
  pattern = {
    ["~/%.config/foo/.*"] = "fooscript",
  },
}

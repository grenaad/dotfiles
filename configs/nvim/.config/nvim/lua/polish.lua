-- if true then return end -- WARN: REMOVE THIS LINE TO ACTIVATE THIS FILE

vim.opt.clipboard = "unnamedplus"

vim.keymap.set("n", "<C-n>", "<cmd>cnext<CR>zz")
vim.keymap.set("n", "<C-p>", "<cmd>cprev<CR>zz")

-- Move visualy selected line up or down
vim.keymap.set("v", "J", ":m '>+1<CR>gv=gv")
vim.keymap.set("v", "K", ":m '<-2<CR>gv=gv")

-- Better indenting
vim.keymap.set("v", "<", "<gv")
vim.keymap.set("v", ">", ">gv")

-- Set up custom filetypes
vim.filetype.add({
  extension = {
    ["http"] = "http",
    ["mq5"] = "cpp", -- MQL5 files as C++
    ["mq4"] = "cpp", -- MQL4 files (if needed)
    ["mqh"] = "cpp", -- MQL header files (if needed)
  },
  filename = {
    ["Foofile"] = "fooscript",
  },
  pattern = {
    ["~/%.config/foo/.*"] = "fooscript",
  },
})

require("cmp").setup.filetype({ "sql" }, {
  sources = {
    { name = "vim-dadbod-completion" },
    { name = "buffer" },
  },
})

require("flutter-tools").setup_project({
  -- can have mulitple projects
  {
    name = "web",
    device = "chrome",
    web_port = "4000",
    target = "lib/main_staging.dart",
  },
  {
    name = "android",
    flavor = "staging",
    target = "lib/main_staging.dart",
    device = "emulator-5554", -- the device ID, which you can get by running `flutter devices`
  },
})

-- required
require("harpoon"):setup()

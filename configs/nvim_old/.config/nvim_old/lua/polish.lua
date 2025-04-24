-- if true then return end -- WARN: REMOVE THIS LINE TO ACTIVATE THIS FILE

-- This will run last in the setup process and is a good place to configure
-- things like custom filetypes. This just pure lua so anything that doesn't
-- fit in the normal config locations above can go here

-- open lsp references in telescope

-- Move between quicklist items
vim.keymap.set("n", "<C-n>", "<cmd>cnext<CR>zz")
vim.keymap.set("n", "<C-p>", "<cmd>cprev<CR>zz")

-- Move visualy selected line up or down
vim.keymap.set("v", "J", ":m '>+1<CR>gv=gv")
vim.keymap.set("v", "K", ":m '<-2<CR>gv=gv")

-- Better indenting
vim.keymap.set("v", "<", "<gv")
vim.keymap.set("v", ">", ">gv")

-- Set up custom filetypes
vim.filetype.add {
  extension = {
    ['http'] = 'http',
  },
  filename = {
    ["Foofile"] = "fooscript",
  },
  pattern = {
    ["~/%.config/foo/.*"] = "fooscript",
  },
}

-- Python setup
-- pyright and ruff 
-- require('lspconfig').pyright.setup {
--   settings = {
--     pyright = {
--       -- Using Ruff's import organizer
--       disableOrganizeImports = true,
--       -- disableLanguageServices = false,
--       -- disableTaggedHints  = false,
--     },
--     python = {
--       analysis = {
--         -- Ignore all files for analysis to exclusively use Ruff for linting
--         ignore = { '*' },
--       },
--     },
--   },
-- }

vim.api.nvim_create_autocmd("LspAttach", {
  group = vim.api.nvim_create_augroup('lsp_attach_disable_ruff_hover', { clear = true }),
  callback = function(args)
    local client = vim.lsp.get_client_by_id(args.data.client_id)
    if client == nil then
      return
    end
    if client.name == 'ruff' then
      -- Disable hover in favor of Pyright
      client.server_capabilities.hoverProvider = false
    end
  end,
  desc = 'LSP: Disable hover capability from Ruff',
})

-- Setup up vim-dadbod
vim.g.dbs = {
    { name = 'local default', url = 'postgres://postgres:postgres@localhost:5432' },
    {
      name = 'dev_autobots',
      url = function()
        local result = os.getenv("DEV_AUTOBOTS")
        -- local result = vim.fn.system('~/work/focaldata/database.sh dev_autobots')
        return result
      end
    },
    {
      name = 'dev respondent',
      url = function()
        local result = os.getenv("DEV_RESPONDENT")
        return result
      end
    },
    {
      name = 'prod respondent',
      url = function()
        local result = os.getenv("PROD_RESPONDENT")

        return result
      end
    },
    {
      name = 'prod questionnaire',
      url = function()
        local result = os.getenv("PROD_QUESTIONNAIRE")

        return result
      end
    },

}
require("cmp").setup.filetype({ "sql" }, {
  sources = {
    { name = "vim-dadbod-completion" },
    { name = "buffer" },
  },
})

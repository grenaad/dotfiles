local util = require 'lspconfig/util'
require'lspconfig'.fsautocomplete.setup {
  cmd = {'fsautocomplete', '--background-service-enabled' },
  root_dir = util.root_pattern('*.sln'),
}

-- local util = require 'lspconfig/util'
-- require'lspconfig'.fsautocomplete.setup{
--     cmd = {'dotnet fsautocomplete', '--background-service-enabled' },
--     root_dir = util.root_pattern('*.sln', '.git'),
-- }

-- using ionide plugin that integrates with nvim-lspconfig


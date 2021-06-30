require("ice.telescope")
require("ice.compe-config")
require("ice.treesitter")
-- require("ice.bash-lsp")
-- require("ice.python-lsp")
-- require("ice.kotlin-lsp")
-- require("ice.java-lsp")

-- This is for the LspInstall plugin
require'lspinstall'.setup() -- important
local servers = require'lspinstall'.installed_servers()
for _, server in pairs(servers) do
  require'lspconfig'[server].setup{}
end


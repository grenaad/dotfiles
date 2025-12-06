return {
  "kristijanhusak/vim-dadbod-ui",
  dependencies = {
    { "tpope/vim-dotenv",                     lazy = true },
    { "tpope/vim-dadbod",                     lazy = true },
    { "kristijanhusak/vim-dadbod-completion", ft = { "sql", "mysql", "plsql" }, lazy = true },
  },
  cmd = {
    "DBUI",
    "DBUIToggle",
    "DBUIAddConnection",
    "DBUIFindBuffer",
  },
  init = function()
    vim.g.db_ui_use_nerd_fonts = 1
    vim.g.db_ui_winwidth = 50
    vim.g.db_ui_show_help = 1
    vim.g.db_ui_use_nvim_notify = 0
    vim.g.db_ui_win_position = "left"

    -- Database connection templates with <password> placeholders
    -- Grouped by service (not environment) for better organization
    -- Ports: Sequential assignment starting from 6000 (each connection has unique port)
    local connection_templates = {
      -- Dashboard Service
      dashboard_dev = "postgresql://dbuser:<password>@localhost:6000/postgres",
      dashboard_prod = "postgresql://dbuser:<password>@localhost:6001/postgres",
      
      -- Respondent Service  
      respondent_dev = "postgresql://dbuser:<password>@localhost:6002/postgres",
      respondent_prod = "postgresql://dbuser:<password>@localhost:6003/postgres",
      respondent_clone = "postgresql://dbuser:<password>@localhost:6004/postgres",
      
      -- Autobots Service
      autobots_dev = "postgresql://dbuser:<password>@localhost:6005/postgres", 
      autobots_prod = "postgresql://dbuser:<password>@localhost:6006/postgres",
      
      -- Chat Analytics Service
      chat_analytics_dev = "postgresql://dbuser:<password>@localhost:6007/postgres",
      chat_analytics_prod = "postgresql://dbuser:<password>@localhost:6008/postgres",
      
      -- Questionnaire Service
      questionnaire_dev = "postgresql://dbuser:<password>@localhost:6009/postgres",
      questionnaire_prod = "postgresql://dbuser:<password>@localhost:6010/postgres",
      
      -- Core Responses Service
      core_responses_dev = "postgresql://dbuser:<password>@localhost:6011/postgres", 
      core_responses_prod = "postgresql://dbuser:<password>@localhost:6012/postgres",
      
      -- Panel Supplier Service
      panel_supplier_dev = "postgresql://dbuser:<password>@localhost:6013/postgres",
      panel_supplier_direct_dev = "postgresql://dbuser:<password>@localhost:6014/postgres",
      panel_supplier_prod = "postgresql://dbuser:<password>@localhost:6015/postgres",
    }

    -- Replace <password> placeholders with decrypted passwords
    local db_connections = require("utils.db_connections")
    vim.g.dbs = db_connections.replace_password_placeholders(connection_templates)
  end,
  specs = {
    {
      "AstroNvim/astrocore",
      opts = {
        mappings = {
          n = {
            ["<leader>D"] = { desc = "󰆼 Db Tools" },
            ["<leader>DD"] = { "<cmd>DBUIToggle<cr>", desc = "DB UI Toggle" },
            ["<leader>Df"] = { "<cmd>DBUIFindBuffer<cr>", desc = "DB UI Find buffer" },
            ["<leader>Dr"] = { "<cmd>DBUIRenameBuffer<cr>", desc = "DB UI Rename buffer" },
            ["<leader>Dl"] = { "<cmd>DBUILastQueryInfo<cr>", desc = "DB UI Last query infos" },
            ["<leader>Dd"] = { desc = "󱘖 Connect" },
            ["<leader>Da"] = { "<cmd>DBUIAddConnection<cr>", desc = " Add Connection" },
            ["<leader>De"] = {
              function()
                local db_connections = require("utils.db_connections")
                db_connections.add_encrypted_password_interactive()
              end,
              desc = "󰆼 Add Encrypted Password"
            },
          },
        },
      },
    },
  },
}

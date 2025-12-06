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
    local connection_templates = {
      -- Dashboard Service
      dashboard_dev = "postgresql://dbuser:<password>@localhost:5408/postgres",
      dashboard_prod = "postgresql://dbuser:<password>@localhost:5406/postgres",
      
      -- Respondent Service  
      respondent_dev = "postgresql://dbuser:<password>@localhost:5410/postgres",
      respondent_prod = "postgresql://dbuser:<password>@localhost:5408/postgres",
      respondent_clone = "postgresql://dbuser:<password>@localhost:5432/postgres",
      
      -- Autobots Service
      autobots_dev = "postgresql://dbuser:<password>@localhost:5408/postgres", 
      autobots_prod = "postgresql://dbuser:<password>@localhost:5405/postgres",
      
      -- Chat Analytics Service
      chat_analytics_dev = "postgresql://dbuser:<password>@localhost:5409/postgres",
      chat_analytics_prod = "postgresql://dbuser:<password>@localhost:5407/postgres",
      
      -- Questionnaire Service
      questionnaire_dev = "postgresql://dbuser:<password>@localhost:5408/postgres",
      questionnaire_prod = "postgresql://dbuser:<password>@localhost:5404/postgres",
      
      -- Core Responses Service
      core_responses_dev = "postgresql://dbuser:<password>@localhost:5412/postgres", 
      core_responses_prod = "postgresql://dbuser:<password>@localhost:5412/postgres",
      
      -- Panel Supplier Service
      panel_supplier_dev = "postgresql://dbuser:<password>@localhost:5411/postgres",
      panel_supplier_direct_dev = "postgresql://dbuser:<password>@localhost:5432/postgres",
      panel_supplier_prod = "postgresql://dbuser:<password>@localhost:5411/postgres",
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

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

    -- Load db connections utility
    local db_connections = require("utils.db_connections")

    -- Database connections using array format with individual password replacement
    vim.g.dbs = {
      -- Dashboard Service
      {
        name = 'dashboard_dev',
        url = db_connections.replace_single_password_placeholder(
          'dashboard_dev',
          'postgresql://dbuser:<password>@localhost:6000/postgres'
        )
      },
      {
        name = 'dashboard_prod',
        url = db_connections.replace_single_password_placeholder(
          'dashboard_prod',
          'postgresql://dbuser:<password>@localhost:6001/postgres'
        )
      },

      -- Respondent Service
      {
        name = 'respondent_dev',
        url = db_connections.replace_single_password_placeholder(
          'respondent_dev',
          'postgresql://dbuser:<password>@localhost:6002/postgres'
        )
      },
      {
        name = 'respondent_prod',
        url = db_connections.replace_single_password_placeholder(
          'respondent_prod',
          'postgresql://dbuser:<password>@localhost:6003/postgres'
        )
      },
      {
        name = 'respondent_clone',
        url = db_connections.replace_single_password_placeholder(
          'respondent_clone',
          'postgresql://dbuser:<password>@localhost:6004/postgres'
        )
      },

      -- Autobots Service
      {
        name = 'autobots_dev',
        url = db_connections.replace_single_password_placeholder(
          'autobots_dev',
          'postgresql://dbuser:<password>@localhost:6005/postgres'
        )
      },
      {
        name = 'autobots_prod',
        url = db_connections.replace_single_password_placeholder(
          'autobots_prod',
          'postgresql://dbuser:<password>@localhost:6006/postgres'
        )
      },

      -- Chat Analytics Service
      {
        name = 'chat_analytics_dev',
        url = db_connections.replace_single_password_placeholder(
          'chat_analytics_dev',
          'postgresql://dbuser:<password>@localhost:6007/postgres'
        )
      },
      {
        name = 'chat_analytics_prod',
        url = db_connections.replace_single_password_placeholder(
          'chat_analytics_prod',
          'postgresql://dbuser:<password>@localhost:6008/postgres'
        )
      },

      -- Questionnaire Service
      {
        name = 'questionnaire_dev',
        url = db_connections.replace_single_password_placeholder(
          'questionnaire_dev',
          'postgresql://dbuser:<password>@localhost:6009/postgres'
        )
      },
      {
        name = 'questionnaire_prod',
        url = db_connections.replace_single_password_placeholder(
          'questionnaire_prod',
          'postgresql://dbuser:<password>@localhost:6010/postgres'
        )
      },

      -- Core Responses Service
      {
        name = 'core_responses_dev',
        url = db_connections.replace_single_password_placeholder(
          'core_responses_dev',
          'postgresql://dbuser:<password>@localhost:6011/postgres'
        )
      },
      {
        name = 'core_responses_prod',
        url = db_connections.replace_single_password_placeholder(
          'core_responses_prod',
          'postgresql://dbuser:<password>@localhost:6012/postgres'
        )
      },

      -- Panel Supplier Service
      {
        name = 'panel_supplier_dev',
        url = db_connections.replace_single_password_placeholder(
          'panel_supplier_dev',
          'postgresql://dbuser:<password>@localhost:6013/postgres'
        )
      },
      {
        name = 'panel_supplier_direct_dev',
        url = db_connections.replace_single_password_placeholder(
          'panel_supplier_direct_dev',
          'postgresql://dbuser:<password>@localhost:6014/postgres'
        )
      },
      {
        name = 'panel_supplier_prod',
        url = db_connections.replace_single_password_placeholder(
          'panel_supplier_prod',
          'postgresql://dbuser:<password>@localhost:6015/postgres'
        )
      },
    }
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
              desc = "󰆼 Add Encrypted Password",
            },
          },
        },
      },
    },
  },
}

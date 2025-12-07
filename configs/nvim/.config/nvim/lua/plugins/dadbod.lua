return {
  "kristijanhusak/vim-dadbod-ui",
  dependencies = {
    { "tpope/vim-dotenv", lazy = true },
    { "tpope/vim-dadbod", lazy = true },
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

    -- Load utilities
    local db_connections = require("utils.db_connections")
    local sql_proxy = require("utils.sql_proxy")

    -- Function to create proxy connection with fallback
    local function connect_to_cloud_sql(port, instance_name, database_name, password_key)
      return function()
        -- Try to start the proxy
        local success = sql_proxy.start_proxy(port, instance_name, { quiet = true, timeout = 30 })

        if success then
          -- Proxy started successfully, return URL with decrypted password
          local template_url = string.format("postgresql://dbuser:<password>@localhost:%d/%s", port, database_name)
          return db_connections.replace_single_password_placeholder(password_key, template_url)
        else
          -- Proxy failed to start, return error URL
          local error_msg = string.format("Failed to connect to Cloud SQL instance: %s", instance_name)
          print("Error: " .. error_msg)
          return string.format("postgresql://error:proxy-failed@localhost:%d/error", port)
        end
      end
    end

    -- Database connections using function-based URLs with Cloud SQL proxy
    vim.g.dbs = {
      -- Core Responses Service
      {
        name = "core_responses_dev",
        url = connect_to_cloud_sql(6011, "cin-dev:europe-west2:fd-core-responses", "coreresponses", "core_responses_dev"),
      },
      {
        name = "core_responses_prod",
        url = connect_to_cloud_sql(6012, "cin-prod:europe-west2:fd-core-responses", "coreresponses", "core_responses_prod"),
      },

      -- Panel Supplier Service
      {
        name = "panel_supplier_dev",
        url = connect_to_cloud_sql(6013, "cin-dev:europe-west2:fd-panel-supplier", "panelsupplier", "panel_supplier_dev"),
      },
      {
        name = "panel_supplier_prod",
        url = connect_to_cloud_sql(6015, "cin-prod:europe-west2:fd-panel-supplier", "panelsupplier", "panel_supplier_prod"),
      },

      -- Respondent Service
      {
        name = "respondent_dev",
        url = connect_to_cloud_sql(6002, "cin-dev:europe-west2:cin-respondent-postgres15-820a7f61", "cinrespondent", "respondent_dev"),
      },
      {
        name = "respondent_prod",
        url = connect_to_cloud_sql(6003, "cin-prod:europe-west2:cin-respondent-postgres15-5ce03841", "cinrespondent", "respondent_prod"),
      },
      {
        name = "respondent_clone",
        url = connect_to_cloud_sql(6004, "cin-prod:europe-west2:cin-respondent-postgres15-5ce03841-replica-replica0", "cinrespondent", "respondent_clone"),
      },

      -- Chat Analytics Service
      {
        name = "chat_analytics_dev",
        url = connect_to_cloud_sql(6007, "cin-dev:europe-west2:fd-chat-analytics-postgres15-0a1a2cd1", "fdchatanalytics", "chat_analytics_dev"),
      },
      {
        name = "chat_analytics_prod",
        url = connect_to_cloud_sql(6008, "cin-prod:europe-west2:fd-chat-analytics-postgres15-fd734f2a", "fdchatanalytics", "chat_analytics_prod"),
      },

      -- Questionnaire Service
      {
        name = "questionnaire_dev",
        url = connect_to_cloud_sql(6009, "cin-dev:europe-west2:cin-db-postgres12-e0a9d96f", "postgres", "questionnaire_dev"),
      },
      {
        name = "questionnaire_prod",
        url = connect_to_cloud_sql(6010, "cin-prod:europe-west2:cin-questionnaire-fieldwork-postgres12-21a420b4", "cinquestionnairefieldwork", "questionnaire_prod"),
      },

      -- Autobots Service (Legacy)
      {
        name = "autobots_dev",
        url = connect_to_cloud_sql(6005, "cin-dev:europe-west2:cin-db-postgres12-e0a9d96f", "postgres", "autobots_dev"),
      },
      {
        name = "autobots_prod",
        url = connect_to_cloud_sql(6006, "cin-prod:europe-west2:cin-db1-postgres12-43b0f512", "postgres", "autobots_prod"),
      },

      -- Dashboard Service (Legacy - using core responses as fallback)
      {
        name = "dashboard_dev",
        url = connect_to_cloud_sql(6000, "cin-dev:europe-west2:fd-core-responses", "coreresponses", "dashboard_dev"),
      },
      {
        name = "dashboard_prod",
        url = connect_to_cloud_sql(6001, "cin-prod:europe-west2:fd-core-responses", "coreresponses", "dashboard_prod"),
      },

      -- Panel Supplier Direct (same as panel supplier)
      {
        name = "panel_supplier_direct_dev",
        url = connect_to_cloud_sql(6014, "cin-dev:europe-west2:fd-panel-supplier", "panelsupplier", "panel_supplier_direct_dev"),
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

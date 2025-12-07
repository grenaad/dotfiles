return {
  "kristijanhusak/vim-dadbod-ui",
  dependencies = {
    { "tpope/vim-dotenv",                     lazy = true },
    { "tpope/vim-dadbod",                     lazy = true },
    {
      "kristijanhusak/vim-dadbod-completion",
      ft = { "sql", "mysql", "plsql" },
      lazy = true,
      specs = {
        {
          "saghen/blink.cmp",
          optional = true,
          opts = {
            sources = {
              per_filetype = {
                sql = { 'snippets', 'dadbod', 'buffer' },
                mysql = { 'snippets', 'dadbod', 'buffer' },
                plsql = { 'snippets', 'dadbod', 'buffer' },
              },
              providers = {
                dadbod = { 
                  name = "Dadbod", 
                  module = "vim_dadbod_completion.blink" 
                },
              },
            },
          },
        },
      },
    },
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

    -- Load database facade
    local database = require("database")

    -- Initialize vim.g.dbs as empty - it will be populated dynamically by the database picker
    -- This allows for better error handling and proxy management
    vim.g.dbs = {}

    -- Helper function to populate vim.g.dbs with all database configs for DBUI autocomplete
    -- This provides fallback URLs with password placeholders for databases that don't have active proxies
    local function populate_all_databases()
      local all_databases = database.get_all_databases()
      local dbs = {}

      for _, db_config in ipairs(all_databases) do
        table.insert(dbs, {
          name = db_config.name,
          url = function()
            -- Generate connection URL with password replacement
            local connection_url = database.generate_connection_url(db_config)
            if connection_url then
              return connection_url
            else
              -- Fallback: return template URL with password placeholder for manual entry
              local template_url = db_config.connection_template
              template_url = template_url:gsub("{port}", tostring(db_config.port))
              template_url = template_url:gsub("{database_name}", db_config.database_name)
              return template_url
            end
          end,
        })
      end

      return dbs
    end

    -- Populate databases for DBUI autocomplete
    vim.g.dbs = populate_all_databases()
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
            ["<leader>Ds"] = {
              function()
                local database = require("database")
                database.pick_database()
              end,
              desc = "📋 Database Selector",
            },
            ["<leader>Dp"] = {
              function()
                local database = require("database")
                database.manage_proxies()
              end,
              desc = "🔧 Manage Proxies",
            },
            ["<leader>Dv"] = {
              function()
                local database = require("database")
                database.pick_database_with_line_content()
              end,
              desc = "📋 Database Search (from line)",
            },
            ["<leader>Da"] = { "<cmd>DBUIAddConnection<cr>", desc = " Add Connection" },
            ["<leader>De"] = {
              function()
                local database = require("database")
                database.add_encrypted_password_interactive()
              end,
              desc = "󰆼 Add Encrypted Password",
            },
          },
        },
      },
    },
  },
}

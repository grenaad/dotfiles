local M = {}

-- Database picker using telescope.nvim
-- Provides searchable interface for database connections with proxy management

local function get_telescope()
  local ok, telescope = pcall(require, "telescope")
  if not ok then
    vim.notify("telescope.nvim is required for database picker", vim.log.levels.ERROR)
    return nil
  end
  return telescope
end

local function get_pickers()
  local ok, pickers = pcall(require, "telescope.pickers")
  if not ok then
    vim.notify("telescope.pickers not available", vim.log.levels.ERROR)
    return nil
  end
  return pickers
end

local function get_finders()
  local ok, finders = pcall(require, "telescope.finders")
  if not ok then
    vim.notify("telescope.finders not available", vim.log.levels.ERROR)
    return nil
  end
  return finders
end

local function get_conf()
  local ok, conf = pcall(require, "telescope.config")
  if not ok then
    vim.notify("telescope.config not available", vim.log.levels.ERROR)
    return nil
  end
  return conf.values
end

local function get_actions()
  local ok, actions = pcall(require, "telescope.actions")
  if not ok then
    vim.notify("telescope.actions not available", vim.log.levels.ERROR)
    return nil
  end
  return actions
end

local function get_action_state()
  local ok, action_state = pcall(require, "telescope.actions.state")
  if not ok then
    vim.notify("telescope.actions.state not available", vim.log.levels.ERROR)
    return nil
  end
  return action_state
end

-- Format database entry for telescope display
-- Args: db_config (table) - database configuration object
-- Returns: string - formatted display text
local function format_db_entry(db_config)
  local sql_proxy = require("utils.sql_proxy")
  local is_running, proxy_info = sql_proxy.is_proxy_running(db_config.port)
  
  local status_icon = is_running and "🟢" or "🔴"
  local env_icon = db_config.environment == "production" and "🏭" or "🧪"
  
  local status_text = is_running and "RUNNING" or "STOPPED"
  local uptime_text = ""
  
  if is_running and proxy_info then
    local uptime_mins = math.floor(proxy_info.uptime / 60)
    uptime_text = string.format(" (up %dm)", uptime_mins)
  end
  
  return string.format(
    "%s %s %-25s [%s%s] %s",
    status_icon,
    env_icon,
    db_config.display_name,
    status_text,
    uptime_text,
    db_config.description
  )
end

-- Get database entry from telescope selection
-- Args: entry (table) - telescope entry object
-- Returns: table - database config object
local function get_db_from_entry(entry)
  return entry.db_config
end

-- Start proxy for database if not already running
-- Args: db_config (table) - database configuration object
-- Returns: boolean - true if proxy is running (was already running or started successfully)
local function ensure_proxy_running(db_config)
  local sql_proxy = require("utils.sql_proxy")
  
  -- Check if already running
  local is_running, _ = sql_proxy.is_proxy_running(db_config.port)
  if is_running then
    vim.notify(
      string.format("Proxy for %s already running on port %d", db_config.display_name, db_config.port),
      vim.log.levels.INFO
    )
    return true
  end
  
  -- Start the proxy
  vim.notify(
    string.format("Starting proxy for %s on port %d...", db_config.display_name, db_config.port),
    vim.log.levels.INFO
  )
  
  local success, job_id = sql_proxy.start_proxy(db_config.port, db_config.instance_name, {
    timeout = 30,
    quiet = false
  })
  
  if success then
    vim.notify(
      string.format(
        "✅ Proxy for %s started successfully (job: %d)",
        db_config.display_name,
        job_id or 0
      ),
      vim.log.levels.INFO
    )
    return true
  else
    vim.notify(
      string.format(
        "❌ Failed to start proxy for %s on port %d",
        db_config.display_name,
        db_config.port
      ),
      vim.log.levels.ERROR
    )
    return false
  end
end

-- Handle database selection - connect and optionally open DBUI
-- Args: db_config (table) - database configuration object
--       open_dbui (boolean) - whether to open DBUI after connecting
local function handle_database_selection(db_config, open_dbui)
  open_dbui = open_dbui ~= false -- default to true
  
  -- Ensure proxy is running
  local proxy_success = ensure_proxy_running(db_config)
  if not proxy_success then
    return false
  end
  
  -- Generate connection URL
  local db_registry = require("utils.db_registry")
  local connection_url = db_registry.generate_connection_url(db_config)
  
  if not connection_url then
    vim.notify(
      string.format("Failed to generate connection URL for %s", db_config.display_name),
      vim.log.levels.ERROR
    )
    return false
  end
  
  -- Update vim.g.dbs with this connection
  -- We'll create a temporary single-database config for immediate use
  vim.g.dbs = {
    {
      name = db_config.name,
      url = connection_url
    }
  }
  
  vim.notify(
    string.format("✅ Connected to %s", db_config.display_name),
    vim.log.levels.INFO
  )
  
  -- Open DBUI if requested
  if open_dbui then
    vim.schedule(function()
      vim.cmd("DBUIToggle")
    end)
  end
  
  return true
end

-- Create telescope picker for database selection
-- Args: opts (table, optional) - telescope picker options
--   - prompt_title (string): custom prompt title
--   - default_text (string): initial search text
--   - cwd (string): working directory context
function M.pick_database(opts)
  local telescope = get_telescope()
  local pickers = get_pickers()
  local finders = get_finders()
  local conf = get_conf()
  local actions = get_actions()
  local action_state = get_action_state()
  
  if not (telescope and pickers and finders and conf and actions and action_state) then
    return
  end
  
  opts = opts or {}
  local db_registry = require("utils.db_registry")
  local databases = db_registry.get_all_databases()
  
  -- Create telescope entries
  local entries = {}
  for _, db in ipairs(databases) do
    table.insert(entries, {
      value = db.name,
      display = format_db_entry(db),
      ordinal = string.format(
        "%s %s %s %s",
        db.name,
        db.display_name,
        db.description,
        table.concat(db.tags, " ")
      ),
      db_config = db
    })
  end
  
  local picker = pickers.new(opts, {
    prompt_title = opts.prompt_title or "📋 Select Database",
    finder = finders.new_table({
      results = entries,
      entry_maker = function(entry)
        return entry
      end
    }),
    sorter = conf.generic_sorter(opts),
    attach_mappings = function(prompt_bufnr, map)
      -- Default action: connect and open DBUI
      actions.select_default:replace(function()
        local selection = action_state.get_selected_entry()
        actions.close(prompt_bufnr)
        
        if selection then
          local db_config = get_db_from_entry(selection)
          local success = handle_database_selection(db_config, true)
          
          -- If connection failed, reopen picker
          if not success then
            vim.schedule(function()
              vim.notify("Connection failed. Reopening database picker...", vim.log.levels.WARN)
              M.pick_database(opts)
            end)
          end
        end
      end)
      
      -- Connect without opening DBUI (Ctrl+Enter)
      map("i", "<C-CR>", function()
        local selection = action_state.get_selected_entry()
        actions.close(prompt_bufnr)
        
        if selection then
          local db_config = get_db_from_entry(selection)
          local success = handle_database_selection(db_config, false)
          
          -- If connection failed, reopen picker
          if not success then
            vim.schedule(function()
              vim.notify("Connection failed. Reopening database picker...", vim.log.levels.WARN)
              M.pick_database(opts)
            end)
          end
        end
      end)
      
      -- Show database details (Ctrl+D)
      map("i", "<C-d>", function()
        local selection = action_state.get_selected_entry()
        if selection then
          local db = get_db_from_entry(selection)
          local sql_proxy = require("utils.sql_proxy")
          local is_running, proxy_info = sql_proxy.is_proxy_running(db.port)
          
          local details = {
            "Database Details:",
            "",
            "Name: " .. db.name,
            "Display Name: " .. db.display_name,
            "Description: " .. db.description,
            "Environment: " .. db.environment,
            "Service: " .. db.service,
            "Tags: " .. table.concat(db.tags, ", "),
            "",
            "Connection Info:",
            "Port: " .. db.port,
            "Instance: " .. db.instance_name,
            "Database: " .. db.database_name,
            "Password Key: " .. db.password_key,
            "",
            "Proxy Status: " .. (is_running and "RUNNING" or "STOPPED")
          }
          
          if is_running and proxy_info then
            table.insert(details, "Uptime: " .. proxy_info.uptime .. " seconds")
            table.insert(details, "Job ID: " .. proxy_info.job_id)
          end
          
          vim.notify(table.concat(details, "\n"), vim.log.levels.INFO)
        end
      end)
      
      -- Stop proxy for selected database (Ctrl+S)
      map("i", "<C-s>", function()
        local selection = action_state.get_selected_entry()
        if selection then
          local db = get_db_from_entry(selection)
          local sql_proxy = require("utils.sql_proxy")
          
          local is_running, _ = sql_proxy.is_proxy_running(db.port)
          if is_running then
            local success = sql_proxy.stop_proxy(db.port)
            if success then
              vim.notify(
                string.format("Stopped proxy for %s", db.display_name),
                vim.log.levels.INFO
              )
            else
              vim.notify(
                string.format("Failed to stop proxy for %s", db.display_name),
                vim.log.levels.ERROR
              )
            end
            
            -- Refresh the picker to update status
            actions.close(prompt_bufnr)
            vim.schedule(function()
              M.pick_database(opts)
            end)
          else
            vim.notify(
              string.format("No proxy running for %s", db.display_name),
              vim.log.levels.WARN
            )
          end
        end
      end)
      
      return true
    end,
  })
  
  picker:find()
end

-- Quick picker for only production databases
function M.pick_production_database()
  M.pick_database({
    prompt_title = "🏭 Select Production Database",
    default_text = "prod"
  })
end

-- Quick picker for only development databases
function M.pick_development_database()
  M.pick_database({
    prompt_title = "🧪 Select Development Database",
    default_text = "dev"
  })
end

-- Picker for proxy management
function M.manage_proxies()
  local sql_proxy = require("utils.sql_proxy")
  local running_proxies = sql_proxy.list_running_proxies()
  
  if #running_proxies == 0 then
    vim.notify("No proxies are currently running", vim.log.levels.INFO)
    return
  end
  
  local telescope = get_telescope()
  local pickers = get_pickers()
  local finders = get_finders()
  local conf = get_conf()
  local actions = get_actions()
  local action_state = get_action_state()
  
  if not (telescope and pickers and finders and conf and actions and action_state) then
    return
  end
  
  -- Create entries for running proxies
  local entries = {}
  for _, proxy in ipairs(running_proxies) do
    local uptime_mins = math.floor(proxy.uptime / 60)
    table.insert(entries, {
      value = proxy.port,
      display = string.format(
        "Port %d - %s (up %dm) [job: %d]",
        proxy.port,
        proxy.instance_name,
        uptime_mins,
        proxy.job_id
      ),
      ordinal = string.format("port %d %s", proxy.port, proxy.instance_name),
      proxy_info = proxy
    })
  end
  
  local picker = pickers.new({}, {
    prompt_title = "🔧 Manage Running Proxies",
    finder = finders.new_table({
      results = entries,
      entry_maker = function(entry)
        return entry
      end
    }),
    sorter = conf.generic_sorter({}),
    attach_mappings = function(prompt_bufnr, map)
      -- Stop proxy (default action)
      actions.select_default:replace(function()
        local selection = action_state.get_selected_entry()
        actions.close(prompt_bufnr)
        
        if selection then
          local port = selection.value
          local success = sql_proxy.stop_proxy(port)
          if success then
            vim.notify(string.format("Stopped proxy on port %d", port), vim.log.levels.INFO)
          else
            vim.notify(string.format("Failed to stop proxy on port %d", port), vim.log.levels.ERROR)
          end
        end
      end)
      
      return true
    end,
  })
  
  picker:find()
end

return M
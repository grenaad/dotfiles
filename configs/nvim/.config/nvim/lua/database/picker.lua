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
  local proxy = require("database.proxy")
  local is_running, proxy_info = proxy.is_proxy_running(db_config.port)
  
  local status_icon = is_running and "🟢" or "🔴"
  local env_icon = db_config.environment == "production" and "🏭" or "🧪"
  
  local status_text = is_running and "RUNNING" or "STOPPED"
  local uptime_text = ""
  
  if is_running and proxy_info and proxy_info.uptime then
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
  local proxy = require("database.proxy")
  
  -- Check if already running
  local is_running, _ = proxy.is_proxy_running(db_config.port)
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
  
  local success, job_id = proxy.start_proxy(db_config.port, db_config.instance_name, {
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

-- Generate connection URL for a database config
-- Args: db_config (table) - database configuration object
-- Returns: string - connection URL with password placeholder replaced, or nil on error
local function generate_connection_url(db_config)
  if not db_config then
    return nil
  end
  
  local passwords = require("database.passwords")
  
  -- Replace template variables
  local url = db_config.connection_template
  url = url:gsub("{port}", tostring(db_config.port))
  url = url:gsub("{database_name}", db_config.database_name)
  
  -- Replace password placeholder with decrypted password
  return passwords.replace_password_placeholder(db_config.password_key, url)
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
  local connection_url = generate_connection_url(db_config)
  
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
      vim.cmd("DBUI")
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
  local registry = require("database.registry")
  local databases = registry.get_all_databases()
  
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
          local proxy = require("database.proxy")
          local is_running, proxy_info = proxy.is_proxy_running(db.port)
          
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
          local proxy = require("database.proxy")
          
          local is_running, _ = proxy.is_proxy_running(db.port)
          if is_running then
            local success = proxy.stop_proxy(db.port)
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

-- Database picker using database name extracted from current line
function M.pick_database_with_line_content()
  local current_line = vim.api.nvim_get_current_line()
  
  -- Try to extract database name patterns from the line
  -- Look for common database naming patterns: service_environment (e.g., core_responses_dev)
  local database_name = ""
  
  -- Pattern 1: Look for database names like "core_responses_dev", "panel_supplier_prod", etc.
  database_name = current_line:match("([%w_]+_dev)") or 
                 current_line:match("([%w_]+_prod)") or 
                 current_line:match("([%w_]+_clone)")
  
  -- Pattern 2: If no _dev/_prod pattern, look for any database-like identifier
  if not database_name then
    database_name = current_line:match("([%w_]+_[%w_]+)")
  end
  
  -- Pattern 3: Fallback to any word that looks like a database identifier
  if not database_name then
    database_name = current_line:match("([%w_]{8,})")
  end
  
  -- If still no match, use the whole line cleaned up
  if not database_name then
    database_name = current_line:gsub("[^%w_]", " "):match("%S+") or ""
  end
  
  M.pick_database({
    prompt_title = "📋 Database Search (from line)",
    default_text = database_name
  })
end

-- Picker for proxy management
function M.manage_proxies()
  local proxy = require("database.proxy")
  local running_proxies = proxy.list_running_proxies()
  
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
  for _, proxy_info in ipairs(running_proxies) do
    local uptime_mins = proxy_info.uptime and math.floor(proxy_info.uptime / 60) or 0
    table.insert(entries, {
      value = proxy_info.port,
      display = string.format(
        "Port %d - %s (up %dm) [job: %d]",
        proxy_info.port,
        proxy_info.instance_name or "unknown",
        uptime_mins,
        proxy_info.job_id or 0
      ),
      ordinal = string.format("port %d %s", proxy_info.port, proxy_info.instance_name),
      proxy_info = proxy_info
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
          local success = proxy.stop_proxy(port)
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
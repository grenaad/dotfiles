local M = {}

-- The Database Facade
-- Single entry point for all database-related functionality

-- Load internal modules
local registry = require("database.registry")
local passwords = require("database.passwords")
local picker = require("database.picker")

-- Export functions that dadbod.lua needs
-- These are the only public APIs from this module

-- Get all database configurations
-- Returns: table - array of database config objects
M.get_all_databases = registry.get_all_databases

-- Generate connection URL for a database config
-- Args: db_config (table) - database configuration object
-- Returns: string - connection URL with password placeholder replaced, or nil on error
function M.generate_connection_url(db_config)
  if not db_config then
    return nil
  end
  
  -- Replace template variables
  local url = db_config.connection_template
  url = url:gsub("{port}", tostring(db_config.port))
  url = url:gsub("{database_name}", db_config.database_name)
  
  -- Pass full db_config instead of password_key
  return passwords.replace_password_placeholder(db_config, url)
end

-- Create telescope picker for database selection
-- Args: opts (table, optional) - telescope picker options
M.pick_database = picker.pick_database

-- Database picker using database name extracted from current line
M.pick_database_with_line_content = picker.pick_database_with_line_content

-- Picker for proxy management
M.manage_proxies = picker.manage_proxies

-- Interactive function to add encrypted password for a connection
-- Args: connection_name (string, optional) - if provided, skip name prompt
-- Returns: boolean - true on success, false on failure
M.add_encrypted_password_interactive = passwords.add_encrypted_password_interactive

return M
local M = {}

-- Database registry configuration
-- This file loads database connection configurations from JSON
local CONFIGS_FILE = vim.fn.stdpath("config") .. "/lua/database/database_configs.json"

-- Get all database configurations
-- Returns: table - array of database config objects
function M.get_all_databases()
  local file = io.open(CONFIGS_FILE, "r")
  if not file then 
    print("Warning: Database configs file not found: " .. CONFIGS_FILE)
    return {} 
  end
  
  local content = file:read("*all")
  file:close()
  
  if content == "" then 
    return {} 
  end
  
  local ok, data = pcall(vim.json.decode, content)
  if not ok then
    print("Error: Failed to parse database configs JSON: " .. tostring(data))
    return {}
  end
  
  return data.databases or {}
end

-- Save all database configurations to JSON file
-- Args: databases (table) - array of database config objects
-- Returns: boolean - true on success, false on failure
function M.save_all_databases(databases)
  local data = { databases = databases }
  
  local file = io.open(CONFIGS_FILE, "w")
  if not file then
    print("Error: Cannot write to " .. CONFIGS_FILE)
    return false
  end
  
  local json_string = vim.json.encode(data)
  file:write(json_string)
  file:close()
  return true
end

return M

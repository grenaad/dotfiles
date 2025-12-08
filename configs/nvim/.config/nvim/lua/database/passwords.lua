local M = {}

-- Get decrypted password for a database config object
-- Args: db_config (table) - database configuration object
-- Returns: decrypted password string, or empty string if not found/failed
function M.get_decrypted_password(db_config)
  if not db_config or not db_config.password_encrypted then
    return ""  -- Return empty string for missing/empty passwords
  end
  
  if db_config.password_encrypted == "" then
    return ""  -- Handle explicitly empty passwords
  end
  
  local crypto = require("database.crypto")
  local decrypted = crypto.decrypt_string(db_config.password_encrypted)
  
  if decrypted == "" then
    print("Warning: Failed to decrypt password for '" .. (db_config.name or "unknown") .. "'")
  end
  
  return decrypted
end

-- Replace <password> placeholder in a single connection string with decrypted password
-- Args: db_config (table) - database configuration object
--       connection_string (string) - URL template that may contain <password> placeholder
-- Returns: string - connection URL with password replaced, or original string if no placeholder
function M.replace_password_placeholder(db_config, connection_string)
  if not db_config or not connection_string then
    return connection_string or ""
  end
  
  if not connection_string:lower():find("<password>") then
    return connection_string  -- No placeholder, return as-is
  end
  
  local decrypted_password = M.get_decrypted_password(db_config)
  
  -- Replace even if password is empty (some connections don't need passwords)
  local pattern = "<[pP][aA][sS][sS][wW][oO][rR][dD]>"
  return connection_string:gsub(pattern, decrypted_password)
end

-- Store encrypted password for a connection name
-- Args: connection_name (string), password (string)
-- Returns: boolean - true on success, false on failure
function M.store_encrypted_password(connection_name, password)
  local registry = require("database.registry") 
  local crypto = require("database.crypto")
  
  -- Load all databases
  local databases = registry.get_all_databases()
  
  -- Find the database with matching name
  local found = false
  for i, db in ipairs(databases) do
    if db.name == connection_name then
      found = true
      -- Encrypt password (allow empty strings)
      local encrypted_password = ""
      if password ~= "" then
        encrypted_password = crypto.encrypt_string(password)
        if encrypted_password == "" and password ~= "" then
          print("Error: Failed to encrypt password for '" .. connection_name .. "'")
          return false
        end
      end
      
      -- Update the database config
      databases[i].password_encrypted = encrypted_password
      break
    end
  end
  
  if not found then
    print("Error: Database '" .. connection_name .. "' not found in configurations")
    return false
  end
  
  -- Save back to file
  local success = registry.save_all_databases(databases)
  if success then
    print("Successfully updated encrypted password for '" .. connection_name .. "'")
  end
  
  return success
end



-- Interactive function to add encrypted password for a connection
-- Args: connection_name (string, optional) - if provided, skip name prompt
-- Returns: boolean - true on success, false on failure
function M.add_encrypted_password_interactive(connection_name)
  local name = connection_name
  
  if not name then
    -- Show available database names for reference
    local registry = require("database.registry")
    local databases = registry.get_all_databases()
    
    print("Available databases:")
    for _, db in ipairs(databases) do
      print("  - " .. db.name .. " (" .. db.display_name .. ")")
    end
    
    name = vim.fn.input("Database name (must exist): ")
    if name == "" then
      print("Database name cannot be empty")
      return false
    end
  end
  
  -- Verify database exists
  local registry = require("database.registry")
  local databases = registry.get_all_databases()
  local exists = false
  for _, db in ipairs(databases) do
    if db.name == name then
      exists = true
      break
    end
  end
  
  if not exists then
    print("Error: Database '" .. name .. "' does not exist in configurations")
    print("Use one of the available database names listed above")
    return false
  end
  
  local password = vim.fn.input("Password for '" .. name .. "' (empty allowed): ")
  -- Note: Empty password is explicitly allowed
  
  return M.store_encrypted_password(name, password)
end

return M
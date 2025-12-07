local crypto = require("utils.crypto_simple")

local M = {}

-- Path to the encrypted passwords JSON file
local CONNECTIONS_FILE = vim.fn.stdpath("config") .. "/lua/utils/encrypted_db_connections.json"

-- Load encrypted passwords from JSON file
-- Returns: table of { connection_name = encrypted_password, ... }
function M.load_encrypted_passwords()
  local encrypted_passwords = {}

  -- Check if file exists
  local file = io.open(CONNECTIONS_FILE, "r")
  if not file then
    -- File doesn't exist, return empty table
    return encrypted_passwords
  end

  -- Read and parse JSON
  local content = file:read("*all")
  file:close()

  if content == "" then
    return encrypted_passwords
  end

  local ok, data = pcall(vim.json.decode, content)
  if not ok then
    print("Error: Failed to parse encrypted passwords JSON: " .. tostring(data))
    return encrypted_passwords
  end

  return data
end

-- Get decrypted password for a specific connection name
-- Args: connection_name (string)
-- Returns: decrypted password string, or nil if not found/failed
function M.get_decrypted_password(connection_name)
  local encrypted_passwords = M.load_encrypted_passwords()
  local encrypted_password = encrypted_passwords[connection_name]

  if not encrypted_password then
    return nil
  end

  local decrypted_password = crypto.decrypt_string(encrypted_password)
  if decrypted_password == "" then
    print("Warning: Failed to decrypt password for connection '" .. connection_name .. "'")
    return nil
  end

  return decrypted_password
end

-- Replace <password> placeholder in a single connection string with decrypted password
-- Args: connection_name (string) - name to look up encrypted password
--       connection_string (string) - URL template that may contain <password> placeholder
-- Returns: string - connection URL with password replaced, or original string if no placeholder or decryption fails
function M.replace_single_password_placeholder(connection_name, connection_string)
  -- Input validation
  if not connection_name or not connection_string then
    return connection_string or ""
  end

  -- Check for <password> placeholder (case-insensitive)
  if not connection_string:lower():find("<password>") then
    -- No placeholder found, return as-is
    return connection_string
  end

  -- Get decrypted password
  local decrypted_password = M.get_decrypted_password(connection_name)

  if decrypted_password then
    -- Replace placeholder with actual password (case-insensitive)
    -- Use pattern matching for case insensitive replacement
    local pattern = "<[pP][aA][sS][sS][wW][oO][rR][dD]>"
    local result = connection_string:gsub(pattern, decrypted_password)
    return result
  else
    -- Decryption failed, log warning and return original string
    print("Warning: Failed to decrypt password for connection '" .. connection_name .. "', leaving placeholder intact")
    return connection_string
  end
end

-- Store encrypted password for a connection name
-- Args: connection_name (string), password (string)
-- Returns: boolean - true on success, false on failure
function M.store_encrypted_password(connection_name, password)
  -- Load existing passwords
  local encrypted_passwords = M.load_encrypted_passwords()

  -- Encrypt the password
  local encrypted_password = crypto.encrypt_string(password)
  if encrypted_password == "" then
    print("Error: Failed to encrypt password for '" .. connection_name .. "'")
    return false
  end

  -- Add to data
  encrypted_passwords[connection_name] = encrypted_password

  -- Write back to file
  local output_file = io.open(CONNECTIONS_FILE, "w")
  if not output_file then
    print("Error: Cannot write to " .. CONNECTIONS_FILE)
    return false
  end

  local json_string = vim.json.encode(encrypted_passwords)
  output_file:write(json_string)
  output_file:close()

  print("Successfully stored encrypted password for '" .. connection_name .. "'")
  return true
end

-- Remove encrypted password for a connection name
-- Args: connection_name (string)
-- Returns: boolean - true on success, false on failure
function M.remove_encrypted_password(connection_name)
  local encrypted_passwords = M.load_encrypted_passwords()

  if encrypted_passwords[connection_name] == nil then
    print("No encrypted password found for '" .. connection_name .. "'")
    return false
  end

  -- Remove the password
  encrypted_passwords[connection_name] = nil

  -- Write back to file
  local output_file = io.open(CONNECTIONS_FILE, "w")
  if not output_file then
    print("Error: Cannot write to " .. CONNECTIONS_FILE)
    return false
  end

  local json_string = vim.json.encode(encrypted_passwords)
  output_file:write(json_string)
  output_file:close()

  print("Successfully removed encrypted password for '" .. connection_name .. "'")
  return true
end

-- List all stored connection names that have encrypted passwords
function M.list_encrypted_passwords()
  local encrypted_passwords = M.load_encrypted_passwords()
  local names = {}

  for name, _ in pairs(encrypted_passwords) do
    table.insert(names, name)
  end

  return names
end

-- Interactive function to add encrypted password for a connection
-- Args: connection_name (string, optional) - if provided, skip name prompt
-- Returns: boolean - true on success, false on failure
function M.add_encrypted_password_interactive(connection_name)
  local name = connection_name

  if not name then
    name = vim.fn.input("Connection name: ")
    if name == "" then
      print("Connection name cannot be empty")
      return false
    end
  end

  local password = vim.fn.input("Password for '" .. name .. "': ")
  if password == "" then
    print("Password cannot be empty")
    return false
  end

  local success = M.store_encrypted_password(name, password)

  if success then
    print("Encrypted password added for '" .. name .. "'!")
  end

  return success
end

-- Legacy function for backward compatibility - now uses template replacement
-- Returns: table formatted for vim.g.dbs assignment with passwords replaced
function M.get_decrypted_database_connections()
  -- This is now a legacy function that returns empty table
  -- The new system uses replace_password_placeholders() with templates from dadbod.lua
  print("Warning: get_decrypted_database_connections() is deprecated. Use replace_password_placeholders() instead.")
  return {}
end

-- Legacy functions maintained for backward compatibility
function M.load_connections()
  print("Warning: load_connections() is deprecated. Use load_encrypted_passwords() instead.")
  return {}
end

function M.store_connection(name, connection_url)
  print("Warning: store_connection() is deprecated. Use store_encrypted_password() instead.")
  return false
end

function M.remove_connection(name)
  print("Warning: remove_connection() is deprecated. Use remove_encrypted_password() instead.")
  return M.remove_encrypted_password(name)
end

function M.list_connections()
  print("Warning: list_connections() is deprecated. Use list_encrypted_passwords() instead.")
  return M.list_encrypted_passwords()
end

function M.add_database_connection(name, connection_url)
  print("Warning: add_database_connection() is deprecated. Use add_encrypted_password_interactive() instead.")
  return false
end

function M.add_encrypted_connection_interactive()
  print("Warning: add_encrypted_connection_interactive() is deprecated. Use add_encrypted_password_interactive() instead.")
  return M.add_encrypted_password_interactive()
end

-- Function to create Cloud SQL proxy connection with fallback
-- Args: port (number) - Local port for proxy database connection
--       instance_name (string) - GCP instance connection name (project:region:instance)
--       database_name (string) - Database name to connect to
--       password_key (string) - Key for encrypted password lookup
-- Returns: string - PostgreSQL connection URL with decrypted password
function M.connect_to_cloud_sql(port, instance_name, database_name, password_key)
  local sql_proxy = require("utils.sql_proxy")
  
  -- Try to start the proxy
  local success = sql_proxy.start_proxy(port, instance_name, { quiet = true, timeout = 30 })
  
  if success then
    -- Proxy started successfully, return URL with decrypted password
    local template_url = string.format("postgresql://dbuser:<password>@localhost:%d/%s", port, database_name)
    return M.replace_single_password_placeholder(password_key, template_url)
  else
    -- Proxy failed to start, return error URL
    local error_msg = string.format("Failed to connect to Cloud SQL instance: %s", instance_name)
    print("Error: " .. error_msg)
    return string.format("postgresql://error:proxy-failed@localhost:%d/error", port)
  end
end

return M

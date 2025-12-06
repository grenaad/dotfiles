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

-- Replace <password> placeholders in connection templates with decrypted passwords
-- Args: connection_templates (table) - table of { connection_name = connection_url_with_placeholder, ... }
-- Returns: table of { connection_name = connection_url_with_real_password, ... }
function M.replace_password_placeholders(connection_templates)
  local result = {}
  
  for name, template_url in pairs(connection_templates) do
    if template_url:find("<password>") then
      -- This connection template has a password placeholder
      local decrypted_password = M.get_decrypted_password(name)
      
      if decrypted_password then
        -- Replace <password> with the actual decrypted password
        local final_url = template_url:gsub("<password>", decrypted_password)
        result[name] = final_url
      else
        -- Password not found or decryption failed
        print("Warning: No encrypted password found for '" .. name .. "', leaving <password> placeholder")
        result[name] = template_url
      end
    else
      -- No password placeholder, use template as-is
      result[name] = template_url
    end
  end
  
  return result
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

return M
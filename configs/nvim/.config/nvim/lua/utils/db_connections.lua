local crypto = require("utils.crypto_simple")

local M = {}

-- Path to the encrypted connections JSON file
local CONNECTIONS_FILE = vim.fn.stdpath("config") .. "/lua/utils/encrypted_db_connections.json"

-- Load and decrypt all database connections from JSON file
-- Returns: table of { connection_name = decrypted_url, ... }
function M.load_connections()
  local connections = {}
  
  -- Check if file exists
  local file = io.open(CONNECTIONS_FILE, "r")
  if not file then
    -- File doesn't exist, return empty table
    return connections
  end
  
  -- Read and parse JSON
  local content = file:read("*all")
  file:close()
  
  if content == "" then
    return connections
  end
  
  local ok, encrypted_data = pcall(vim.json.decode, content)
  if not ok then
    print("Error: Failed to parse encrypted connections JSON: " .. tostring(encrypted_data))
    return connections
  end
  
  -- Decrypt each connection
  for name, encrypted_url in pairs(encrypted_data) do
    local decrypted_url = crypto.decrypt_string(encrypted_url)
    if decrypted_url ~= "" then
      connections[name] = decrypted_url
    else
      print("Warning: Failed to decrypt connection '" .. name .. "'")
    end
  end
  
  return connections
end

-- Encrypt and store a new database connection
-- Args: name (string), connection_url (string)
function M.store_connection(name, connection_url)
  -- Load existing connections
  local file = io.open(CONNECTIONS_FILE, "r")
  local encrypted_data = {}
  
  if file then
    local content = file:read("*all")
    file:close()
    
    if content ~= "" then
      local ok, data = pcall(vim.json.decode, content)
      if ok then
        encrypted_data = data
      else
        print("Warning: Failed to parse existing connections, starting fresh")
      end
    end
  end
  
  -- Encrypt the new connection
  local encrypted_url = crypto.encrypt_string(connection_url)
  if encrypted_url == "" then
    print("Error: Failed to encrypt connection for '" .. name .. "'")
    return false
  end
  
  -- Add to data
  encrypted_data[name] = encrypted_url
  
  -- Write back to file
  local output_file = io.open(CONNECTIONS_FILE, "w")
  if not output_file then
    print("Error: Cannot write to " .. CONNECTIONS_FILE)
    return false
  end
  
  local json_string = vim.json.encode(encrypted_data)
  output_file:write(json_string)
  output_file:close()
  
  print("Successfully stored encrypted connection '" .. name .. "'")
  return true
end

-- Remove a connection from storage
function M.remove_connection(name)
  local file = io.open(CONNECTIONS_FILE, "r")
  if not file then
    print("No connections file found")
    return false
  end
  
  local content = file:read("*all")
  file:close()
  
  if content == "" then
    print("No connections found")
    return false
  end
  
  local ok, encrypted_data = pcall(vim.json.decode, content)
  if not ok then
    print("Error: Failed to parse connections file")
    return false
  end
  
  if encrypted_data[name] == nil then
    print("Connection '" .. name .. "' not found")
    return false
  end
  
  -- Remove the connection
  encrypted_data[name] = nil
  
  -- Write back to file
  local output_file = io.open(CONNECTIONS_FILE, "w")
  if not output_file then
    print("Error: Cannot write to " .. CONNECTIONS_FILE)
    return false
  end
  
  local json_string = vim.json.encode(encrypted_data)
  output_file:write(json_string)
  output_file:close()
  
  print("Successfully removed connection '" .. name .. "'")
  return true
end

-- List all stored connection names
function M.list_connections()
  local file = io.open(CONNECTIONS_FILE, "r")
  if not file then
    print("No connections file found")
    return {}
  end
  
  local content = file:read("*all")
  file:close()
  
  if content == "" then
    print("No connections found")
    return {}
  end
  
  local ok, encrypted_data = pcall(vim.json.decode, content)
  if not ok then
    print("Error: Failed to parse connections file")
    return {}
  end
  
  local names = {}
  for name, _ in pairs(encrypted_data) do
    table.insert(names, name)
  end
  
  return names
end

-- Get decrypted database connections in vim.g.dbs format
-- Returns: table formatted for vim.g.dbs assignment, empty table if no connections or on error
-- Always reads fresh from JSON file
function M.get_decrypted_database_connections()
  local success, encrypted_connections = pcall(M.load_connections)
  
  if not success then
    print("Error: Failed to load encrypted database connections: " .. tostring(encrypted_connections))
    return {}
  end
  
  local vim_dbs_format = {}
  
  for name, url in pairs(encrypted_connections) do
    vim_dbs_format[name] = url
  end
  
  return vim_dbs_format
end

-- Add a new encrypted database connection
-- Args: name (string), connection_url (string)
-- Returns: boolean - true on success, false on failure
function M.add_database_connection(name, connection_url)
  if not name or name == "" then
    print("Error: Connection name cannot be empty")
    return false
  end
  
  if not connection_url or connection_url == "" then
    print("Error: Connection URL cannot be empty")
    return false
  end
  
  local success = M.store_connection(name, connection_url)
  
  if success then
    print("Connection '" .. name .. "' added successfully!")
    return true
  else
    print("Failed to add connection '" .. name .. "'")
    return false
  end
end

-- Interactive function to add encrypted connection with user prompts
-- Returns: table of all decrypted connections (always returns current state)
function M.add_encrypted_connection_interactive()
  local name = vim.fn.input("Connection name: ")
  if name == "" then
    print("Connection name cannot be empty")
    return M.get_decrypted_database_connections()
  end
  
  local url = vim.fn.input("Connection URL: ")
  if url == "" then
    print("Connection URL cannot be empty")
    return M.get_decrypted_database_connections()
  end
  
  local success = M.add_database_connection(name, url)
  
  if success then
    print("Connection added! Restart DBUI to see changes.")
  end
  
  -- Always return current connections (whether new one was added or not)
  return M.get_decrypted_database_connections()
end

return M
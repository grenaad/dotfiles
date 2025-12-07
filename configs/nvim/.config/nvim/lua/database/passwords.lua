local M = {}

-- Path to the encrypted passwords JSON file
local PASSWORDS_FILE = vim.fn.stdpath("config") .. "/lua/database/encrypted_passwords.json"

-- Load encrypted passwords from JSON file
-- Returns: table of { connection_name = encrypted_password, ... }
function M.load_encrypted_passwords()
  local encrypted_passwords = {}

  -- Check if file exists
  local file = io.open(PASSWORDS_FILE, "r")
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
  local crypto = require("database.crypto")
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
function M.replace_password_placeholder(connection_name, connection_string)
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
  local crypto = require("database.crypto")
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
  local output_file = io.open(PASSWORDS_FILE, "w")
  if not output_file then
    print("Error: Cannot write to " .. PASSWORDS_FILE)
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
  local output_file = io.open(PASSWORDS_FILE, "w")
  if not output_file then
    print("Error: Cannot write to " .. PASSWORDS_FILE)
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

return M
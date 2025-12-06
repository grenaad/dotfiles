local M = {}

-- Hardcoded SSH key paths
local SSH_PRIVATE_KEY = "/Users/ice/.ssh/id_rsa"
local SSH_PUBLIC_KEY = "/Users/ice/.ssh/id_rsa.pub"

-- Utility function for executing shell commands
local function execute_command(cmd)
  local handle = io.popen(cmd .. " 2>&1")
  if not handle then
    return nil, "Failed to execute command"
  end
  
  local result = handle:read("*a")
  local success = handle:close()
  
  if not success then
    return nil, "Command failed: " .. (result or "unknown error")
  end
  
  return result:gsub("%s+$", ""), nil -- trim trailing whitespace
end

-- Encrypt a string using SSH public key
-- @param input_string string: The plain text to encrypt
-- @return string: Base64-encoded encrypted data, or empty string on error
function M.encrypt_string(input_string)
  if not input_string or input_string == "" then
    print("CryptoSimple: Input string cannot be empty")
    return ""
  end
  
  -- Check if SSH keys exist
  local pub_file = io.open(SSH_PUBLIC_KEY, "r")
  if not pub_file then
    print("CryptoSimple: SSH public key not found at " .. SSH_PUBLIC_KEY)
    return ""
  end
  pub_file:close()
  
  -- Create temporary file for input
  local temp_input = os.tmpname()
  local input_file = io.open(temp_input, "w")
  if not input_file then
    print("CryptoSimple: Failed to create temporary input file")
    return ""
  end
  input_file:write(input_string)
  input_file:close()
  
  -- Create temporary PEM public key file
  local temp_pem = os.tmpname()
  local pem_cmd = string.format("ssh-keygen -f %s -e -m pem > %s", SSH_PUBLIC_KEY, temp_pem)
  local _, pem_err = execute_command(pem_cmd)
  
  if pem_err then
    os.remove(temp_input)
    os.remove(temp_pem)
    print("CryptoSimple: Failed to convert SSH key to PEM format - " .. pem_err)
    return ""
  end
  
  -- Encrypt using OpenSSL
  local cmd = string.format(
    "openssl pkeyutl -encrypt -pubin -inkey %s -pkeyopt rsa_padding_mode:pkcs1 -in %s | base64 -w 0",
    temp_pem,
    temp_input
  )
  
  local encrypted_data, encrypt_err = execute_command(cmd)
  
  -- Clean up temporary files
  os.remove(temp_input)
  os.remove(temp_pem)
  
  if encrypt_err then
    print("CryptoSimple: Encryption failed - " .. encrypt_err)
    return ""
  end
  
  if not encrypted_data or encrypted_data == "" then
    print("CryptoSimple: Encryption produced no output")
    return ""
  end
  
  return encrypted_data
end

-- Decrypt a string using SSH private key  
-- @param encrypted_string string: Base64-encoded encrypted data
-- @return string: Plain text, or empty string on error
function M.decrypt_string(encrypted_string)
  if not encrypted_string or encrypted_string == "" then
    print("CryptoSimple: Encrypted string cannot be empty")
    return ""
  end
  
  -- Check if SSH private key exists
  local priv_file = io.open(SSH_PRIVATE_KEY, "r")
  if not priv_file then
    print("CryptoSimple: SSH private key not found at " .. SSH_PRIVATE_KEY)
    return ""
  end
  priv_file:close()
  
  -- Create temporary file for encrypted data
  local temp_encrypted = os.tmpname()
  local encrypted_file = io.open(temp_encrypted, "w")
  if not encrypted_file then
    print("CryptoSimple: Failed to create temporary encrypted file")
    return ""
  end
  encrypted_file:write(encrypted_string)
  encrypted_file:close()
  
  -- Decrypt using OpenSSL
  local cmd = string.format(
    "base64 -d -i %s | openssl pkeyutl -decrypt -inkey %s",
    temp_encrypted,
    SSH_PRIVATE_KEY
  )
  
  local decrypted_data, decrypt_err = execute_command(cmd)
  
  -- Clean up temporary file
  os.remove(temp_encrypted)
  
  if decrypt_err then
    print("CryptoSimple: Decryption failed - " .. decrypt_err)
    return ""
  end
  
  if not decrypted_data then
    print("CryptoSimple: Decryption produced no output")
    return ""
  end
  
  return decrypted_data
end

return M
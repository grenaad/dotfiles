local M = {}

-- Table to track running proxy jobs
local running_proxies = {}

-- Find an available port for health checks starting from base_port
local function find_available_port(base_port)
  base_port = base_port or 9090
  for i = 0, 100 do
    local port = base_port + i
    local handle = io.popen("lsof -i :" .. port .. " 2>/dev/null | wc -l")
    local result = handle:read("*a")
    handle:close()
    if tonumber(result:match("%d+")) == 0 then
      return port
    end
  end
  return nil
end

-- Check if cloud-sql-proxy is available
local function is_proxy_available()
  local handle = io.popen("which cloud-sql-proxy 2>/dev/null")
  local result = handle:read("*a")
  handle:close()
  return result ~= ""
end

-- Validate instance name format (project:region:instance)
local function validate_instance_name(instance_name)
  if not instance_name then
    return false, "Instance name is required"
  end
  
  local parts = {}
  for part in instance_name:gmatch("[^:]+") do
    table.insert(parts, part)
  end
  
  if #parts ~= 3 then
    return false, "Instance name must be in format: project:region:instance"
  end
  
  return true, nil
end

-- Check if port is available
local function is_port_available(port)
  local handle = io.popen("lsof -i :" .. port .. " 2>/dev/null | wc -l")
  local result = handle:read("*a")
  handle:close()
  return tonumber(result:match("%d+")) == 0
end

-- Poll health endpoint until ready or timeout
local function wait_for_proxy_ready(health_port, timeout_seconds)
  timeout_seconds = timeout_seconds or 30
  local start_time = vim.loop.hrtime()
  local timeout_ns = timeout_seconds * 1000000000
  
  while (vim.loop.hrtime() - start_time) < timeout_ns do
    local handle = io.popen("curl -s -o /dev/null -w '%{http_code}' http://localhost:" .. health_port .. "/readiness 2>/dev/null")
    local response = handle:read("*a")
    handle:close()
    
    if response == "200" then
      return true
    end
    
    -- Wait 500ms before next check
    vim.loop.sleep(500)
  end
  
  return false
end

-- Start a cloud-sql-proxy instance
-- Args:
--   port (number): Local port for proxy database connection
--   instance_name (string): GCP instance connection name (project:region:instance)
--   options (table, optional): Additional configuration
--     - timeout (number): Seconds to wait for proxy ready (default: 30)
--     - quiet (boolean): Suppress non-error output (default: false)
-- Returns:
--   success (boolean): true if connected successfully, false if failed
--   job_id (number): Process job ID for tracking (if successful)
function M.start_proxy(port, instance_name, options)
  options = options or {}
  local timeout = options.timeout or 30
  local quiet = options.quiet or false
  
  -- Validate inputs
  if not port or type(port) ~= "number" then
    local msg = "Error: Port must be a number"
    print(msg)
    return false, nil
  end
  
  local valid, err = validate_instance_name(instance_name)
  if not valid then
    local msg = "Error: " .. err
    print(msg)
    return false, nil
  end
  
  -- Check if cloud-sql-proxy is available
  if not is_proxy_available() then
    local msg = "Error: cloud-sql-proxy not found in PATH. Install with: gcloud components install cloud-sql-proxy"
    print(msg)
    return false, nil
  end
  
  -- Check if port is available
  if not is_port_available(port) then
    local msg = "Error: Port " .. port .. " is already in use"
    print(msg)
    return false, nil
  end
  
  -- Check if proxy already running on this port
  if running_proxies[port] then
    local msg = "Warning: Proxy already running on port " .. port
    if not quiet then print(msg) end
    return true, running_proxies[port].job_id
  end
  
  -- Find available health check port
  local health_port = find_available_port(9090)
  if not health_port then
    local msg = "Error: Could not find available port for health checks"
    print(msg)
    return false, nil
  end
  
  -- Build command
  local cmd = {
    "cloud-sql-proxy",
    "--port", tostring(port),
    "--health-check",
    "--http-port", tostring(health_port),
    "--quiet",
    instance_name
  }
  
  if not quiet then
    print("Starting cloud-sql-proxy on port " .. port .. " for " .. instance_name)
    print("Health check on port " .. health_port)
    print("Command: " .. table.concat(cmd, " "))
  end
  
  -- Start the proxy process
  local job_id = vim.fn.jobstart(cmd, {
    detach = true,
    on_exit = function(job_id, exit_code, event)
      -- Remove from tracking when process exits
      for p, info in pairs(running_proxies) do
        if info.job_id == job_id then
          running_proxies[p] = nil
          if not quiet then
            print("Cloud SQL proxy on port " .. p .. " exited with code " .. exit_code)
          end
          break
        end
      end
    end,
    on_stderr = function(job_id, data, event)
      -- Enhanced error logging with context
      if data and #data > 0 then
        for _, line in ipairs(data) do
          if line ~= "" and not line:match("^%s*$") then
            print(string.format(
              "Cloud SQL Proxy Error [job:%d, port:%d, instance:%s]: %s", 
              job_id, port, instance_name, line
            ))
          end
        end
      end
    end
  })
  
  if job_id <= 0 then
    local msg = string.format(
      "Error: Failed to start cloud-sql-proxy process (job_id: %d)\n" ..
      "Command: %s\n" ..
      "Port: %d, Instance: %s\n" ..
      "Check if cloud-sql-proxy is installed and instance name is correct",
      job_id, table.concat(cmd, " "), port, instance_name
    )
    print(msg)
    return false, nil
  end
  
  -- Track the running proxy
  running_proxies[port] = {
    job_id = job_id,
    instance_name = instance_name,
    health_port = health_port,
    started_at = os.time()
  }
  
  -- Wait for proxy to become ready
  if not quiet then
    print("Waiting for proxy to become ready (timeout: " .. timeout .. "s)...")
  end
  
  local ready = wait_for_proxy_ready(health_port, timeout)
  
  if ready then
    if not quiet then
      print("Cloud SQL proxy ready on port " .. port)
    end
    return true, job_id
  else
    -- Cleanup failed proxy
    vim.fn.jobstop(job_id)
    running_proxies[port] = nil
    local msg = string.format(
      "Error: Proxy failed to become ready within %d seconds\n" ..
      "Port: %d, Health port: %d, Instance: %s\n" ..
      "Check if instance exists and you have proper GCP credentials",
      timeout, port, health_port, instance_name
    )
    print(msg)
    return false, nil
  end
end

-- Stop a proxy running on the specified port
-- Args:
--   port (number): Port of the proxy to stop
-- Returns:
--   success (boolean): true if stopped successfully
function M.stop_proxy(port)
  if not running_proxies[port] then
    print("No proxy running on port " .. port)
    return false
  end
  
  local job_id = running_proxies[port].job_id
  local result = vim.fn.jobstop(job_id)
  
  if result == 1 then
    print("Stopped cloud-sql-proxy on port " .. port)
    running_proxies[port] = nil
    return true
  else
    print("Failed to stop proxy on port " .. port)
    return false
  end
end

-- Check if a proxy is running on the specified port
-- Args:
--   port (number): Port to check
-- Returns:
--   running (boolean): true if proxy is running
--   info (table): Proxy information if running
function M.is_proxy_running(port)
  if running_proxies[port] then
    return true, running_proxies[port]
  end
  return false, nil
end

-- List all running proxies
-- Returns:
--   proxies (table): Array of proxy information
function M.list_running_proxies()
  local proxies = {}
  for port, info in pairs(running_proxies) do
    table.insert(proxies, {
      port = port,
      instance_name = info.instance_name,
      job_id = info.job_id,
      health_port = info.health_port,
      started_at = info.started_at,
      uptime = os.time() - info.started_at
    })
  end
  return proxies
end

-- Stop all running proxies
-- Returns:
--   stopped_count (number): Number of proxies stopped
function M.cleanup_all_proxies()
  local count = 0
  for port, info in pairs(running_proxies) do
    if vim.fn.jobstop(info.job_id) == 1 then
      count = count + 1
    end
  end
  
  running_proxies = {}
  
  if count > 0 then
    print("Stopped " .. count .. " cloud-sql-proxy instance(s)")
  end
  
  return count
end

-- Setup auto-cleanup on Neovim exit
local function setup_auto_cleanup()
  vim.api.nvim_create_autocmd("VimLeavePre", {
    desc = "Cleanup cloud-sql-proxy instances on exit",
    callback = function()
      M.cleanup_all_proxies()
    end,
  })
end

-- Initialize the module
setup_auto_cleanup()

return M
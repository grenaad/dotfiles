local M = {}

-- Database registry configuration
-- This file contains all database connection configurations
local database_configs = {
  -- Core Responses Service
  {
    name = "core_responses_dev",
    display_name = "Core Responses (Dev)",
    description = "Development environment for core responses service",
    port = 6011,
    instance_name = "cin-dev:europe-west2:fd-core-responses",
    database_name = "coreresponses",
    password_key = "core_responses_dev",
    connection_template = "postgresql://dbuser:<password>@localhost:{port}/{database_name}",
    tags = {"dev", "core-responses"},
    environment = "development",
    service = "core-responses"
  },
  {
    name = "core_responses_prod",
    display_name = "Core Responses (Prod)",
    description = "Production environment for core responses service",
    port = 6012,
    instance_name = "cin-prod:europe-west2:fd-core-responses",
    database_name = "coreresponses",
    password_key = "core_responses_prod",
    connection_template = "postgresql://dbuser:<password>@localhost:{port}/{database_name}",
    tags = {"prod", "core-responses"},
    environment = "production",
    service = "core-responses"
  },

  -- Panel Supplier Service
  {
    name = "panel_supplier_dev",
    display_name = "Panel Supplier (Dev)",
    description = "Development environment for panel supplier service",
    port = 6013,
    instance_name = "cin-dev:europe-west2:fd-panel-supplier",
    database_name = "panelsupplier",
    password_key = "panel_supplier_dev",
    connection_template = "postgresql://dbuser:<password>@localhost:{port}/{database_name}",
    tags = {"dev", "panel-supplier"},
    environment = "development",
    service = "panel-supplier"
  },
  {
    name = "panel_supplier_prod",
    display_name = "Panel Supplier (Prod)",
    description = "Production environment for panel supplier service",
    port = 6015,
    instance_name = "cin-prod:europe-west2:fd-panel-supplier",
    database_name = "panelsupplier",
    password_key = "panel_supplier_prod",
    connection_template = "postgresql://dbuser:<password>@localhost:{port}/{database_name}",
    tags = {"prod", "panel-supplier"},
    environment = "production",
    service = "panel-supplier"
  },
  {
    name = "panel_supplier_direct_dev",
    display_name = "Panel Supplier Direct (Dev)",
    description = "Development environment for panel supplier direct access",
    port = 6014,
    instance_name = "cin-dev:europe-west2:fd-panel-supplier",
    database_name = "panelsupplier",
    password_key = "panel_supplier_direct_dev",
    connection_template = "postgresql://dbuser:<password>@localhost:{port}/{database_name}",
    tags = {"dev", "panel-supplier", "direct"},
    environment = "development",
    service = "panel-supplier"
  },

  -- Respondent Service
  {
    name = "respondent_dev",
    display_name = "Respondent (Dev)",
    description = "Development environment for respondent service",
    port = 6002,
    instance_name = "cin-dev:europe-west2:cin-respondent-postgres15-820a7f61",
    database_name = "cinrespondent",
    password_key = "respondent_dev",
    connection_template = "postgresql://dbuser:<password>@localhost:{port}/{database_name}",
    tags = {"dev", "respondent"},
    environment = "development",
    service = "respondent"
  },
  {
    name = "respondent_prod",
    display_name = "Respondent (Prod)",
    description = "Production environment for respondent service",
    port = 6003,
    instance_name = "cin-prod:europe-west2:cin-respondent-postgres15-5ce03841",
    database_name = "cinrespondent",
    password_key = "respondent_prod",
    connection_template = "postgresql://dbuser:<password>@localhost:{port}/{database_name}",
    tags = {"prod", "respondent"},
    environment = "production",
    service = "respondent"
  },
  {
    name = "respondent_clone",
    display_name = "Respondent (Clone/Replica)",
    description = "Production replica for respondent service",
    port = 6004,
    instance_name = "cin-prod:europe-west2:cin-respondent-postgres15-5ce03841-replica-replica0",
    database_name = "cinrespondent",
    password_key = "respondent_clone",
    connection_template = "postgresql://dbuser:<password>@localhost:{port}/{database_name}",
    tags = {"replica", "respondent", "read-only"},
    environment = "production",
    service = "respondent"
  },

  -- Chat Analytics Service
  {
    name = "chat_analytics_dev",
    display_name = "Chat Analytics (Dev)",
    description = "Development environment for chat analytics service",
    port = 6007,
    instance_name = "cin-dev:europe-west2:fd-chat-analytics-postgres15-0a1a2cd1",
    database_name = "fdchatanalytics",
    password_key = "chat_analytics_dev",
    connection_template = "postgresql://dbuser:<password>@localhost:{port}/{database_name}",
    tags = {"dev", "chat-analytics"},
    environment = "development",
    service = "chat-analytics"
  },
  {
    name = "chat_analytics_prod",
    display_name = "Chat Analytics (Prod)",
    description = "Production environment for chat analytics service",
    port = 6008,
    instance_name = "cin-prod:europe-west2:fd-chat-analytics-postgres15-fd734f2a",
    database_name = "fdchatanalytics",
    password_key = "chat_analytics_prod",
    connection_template = "postgresql://dbuser:<password>@localhost:{port}/{database_name}",
    tags = {"prod", "chat-analytics"},
    environment = "production",
    service = "chat-analytics"
  },

  -- Questionnaire Service
  {
    name = "questionnaire_dev",
    display_name = "Questionnaire (Dev)",
    description = "Development environment for questionnaire service",
    port = 6009,
    instance_name = "cin-dev:europe-west2:cin-db-postgres12-e0a9d96f",
    database_name = "postgres",
    password_key = "questionnaire_dev",
    connection_template = "postgresql://dbuser:<password>@localhost:{port}/{database_name}",
    tags = {"dev", "questionnaire"},
    environment = "development",
    service = "questionnaire"
  },
  {
    name = "questionnaire_prod",
    display_name = "Questionnaire (Prod)",
    description = "Production environment for questionnaire service",
    port = 6010,
    instance_name = "cin-prod:europe-west2:cin-questionnaire-fieldwork-postgres12-21a420b4",
    database_name = "cinquestionnairefieldwork",
    password_key = "questionnaire_prod",
    connection_template = "postgresql://dbuser:<password>@localhost:{port}/{database_name}",
    tags = {"prod", "questionnaire"},
    environment = "production",
    service = "questionnaire"
  },

  -- Autobots Service (Legacy)
  {
    name = "autobots_dev",
    display_name = "Autobots (Dev)",
    description = "Development environment for autobots service (legacy)",
    port = 6005,
    instance_name = "cin-dev:europe-west2:cin-db-postgres12-e0a9d96f",
    database_name = "postgres",
    password_key = "autobots_dev",
    connection_template = "postgresql://dbuser:<password>@localhost:{port}/{database_name}",
    tags = {"dev", "autobots", "legacy"},
    environment = "development",
    service = "autobots"
  },
  {
    name = "autobots_prod",
    display_name = "Autobots (Prod)",
    description = "Production environment for autobots service (legacy)",
    port = 6006,
    instance_name = "cin-prod:europe-west2:cin-db1-postgres12-43b0f512",
    database_name = "postgres",
    password_key = "autobots_prod",
    connection_template = "postgresql://dbuser:<password>@localhost:{port}/{database_name}",
    tags = {"prod", "autobots", "legacy"},
    environment = "production",
    service = "autobots"
  },

  -- Dashboard Service (Legacy - using core responses as fallback)
  {
    name = "dashboard_dev",
    display_name = "Dashboard (Dev)",
    description = "Development environment for dashboard service (legacy, using core responses)",
    port = 6000,
    instance_name = "cin-dev:europe-west2:fd-core-responses",
    database_name = "coreresponses",
    password_key = "dashboard_dev",
    connection_template = "postgresql://dbuser:<password>@localhost:{port}/{database_name}",
    tags = {"dev", "dashboard", "legacy"},
    environment = "development",
    service = "dashboard"
  },
  {
    name = "dashboard_prod",
    display_name = "Dashboard (Prod)",
    description = "Production environment for dashboard service (legacy, using core responses)",
    port = 6001,
    instance_name = "cin-prod:europe-west2:fd-core-responses",
    database_name = "coreresponses",
    password_key = "dashboard_prod",
    connection_template = "postgresql://dbuser:<password>@localhost:{port}/{database_name}",
    tags = {"prod", "dashboard", "legacy"},
    environment = "production",
    service = "dashboard"
  },
}

-- Get all database configurations
-- Returns: table - array of database config objects
function M.get_all_databases()
  return vim.deepcopy(database_configs)
end

-- Get database configuration by name
-- Args: name (string) - database name identifier
-- Returns: table or nil - database config object or nil if not found
function M.get_database(name)
  for _, db in ipairs(database_configs) do
    if db.name == name then
      return vim.deepcopy(db)
    end
  end
  return nil
end

-- Filter databases by criteria
-- Args: filters (table) - filter criteria
--   - environment (string): "development", "production", etc.
--   - service (string): service name to filter by
--   - tags (table): array of tags that must all be present
--   - search (string): search term for name/display_name/description
-- Returns: table - array of matching database configs
function M.filter_databases(filters)
  filters = filters or {}
  local results = {}
  
  for _, db in ipairs(database_configs) do
    local matches = true
    
    -- Environment filter
    if filters.environment and db.environment ~= filters.environment then
      matches = false
    end
    
    -- Service filter
    if filters.service and db.service ~= filters.service then
      matches = false
    end
    
    -- Tags filter (all tags must be present)
    if filters.tags and #filters.tags > 0 then
      for _, required_tag in ipairs(filters.tags) do
        local has_tag = false
        for _, db_tag in ipairs(db.tags) do
          if db_tag == required_tag then
            has_tag = true
            break
          end
        end
        if not has_tag then
          matches = false
          break
        end
      end
    end
    
    -- Search filter (case-insensitive search in name, display_name, description)
    if filters.search and filters.search ~= "" then
      local search_lower = filters.search:lower()
      local searchable = (db.name:lower() .. " " ..
                         db.display_name:lower() .. " " ..
                         db.description:lower())
      if not searchable:find(search_lower, 1, true) then
        matches = false
      end
    end
    
    if matches then
      table.insert(results, vim.deepcopy(db))
    end
  end
  
  return results
end

-- Generate connection URL for a database config
-- Args: db_config (table) - database configuration object
-- Returns: string - connection URL with password placeholder replaced, or nil on error
function M.generate_connection_url(db_config)
  if not db_config then
    return nil
  end
  
  local db_connections = require("utils.db_connections")
  
  -- Replace template variables
  local url = db_config.connection_template
  url = url:gsub("{port}", tostring(db_config.port))
  url = url:gsub("{database_name}", db_config.database_name)
  
  -- Replace password placeholder with decrypted password
  return db_connections.replace_single_password_placeholder(db_config.password_key, url)
end

-- Get all unique environments
-- Returns: table - array of environment strings
function M.get_environments()
  local environments = {}
  local seen = {}
  
  for _, db in ipairs(database_configs) do
    if db.environment and not seen[db.environment] then
      table.insert(environments, db.environment)
      seen[db.environment] = true
    end
  end
  
  table.sort(environments)
  return environments
end

-- Get all unique services
-- Returns: table - array of service strings
function M.get_services()
  local services = {}
  local seen = {}
  
  for _, db in ipairs(database_configs) do
    if db.service and not seen[db.service] then
      table.insert(services, db.service)
      seen[db.service] = true
    end
  end
  
  table.sort(services)
  return services
end

-- Get all unique tags
-- Returns: table - array of tag strings
function M.get_tags()
  local tags = {}
  local seen = {}
  
  for _, db in ipairs(database_configs) do
    if db.tags then
      for _, tag in ipairs(db.tags) do
        if not seen[tag] then
          table.insert(tags, tag)
          seen[tag] = true
        end
      end
    end
  end
  
  table.sort(tags)
  return tags
end

-- Validate database configuration
-- Args: db_config (table) - database configuration object
-- Returns: boolean, string - true if valid, or false with error message
function M.validate_database_config(db_config)
  if not db_config then
    return false, "Database config cannot be nil"
  end
  
  local required_fields = {
    "name", "display_name", "description", "port", "instance_name", 
    "database_name", "password_key", "connection_template"
  }
  
  for _, field in ipairs(required_fields) do
    if not db_config[field] or db_config[field] == "" then
      return false, "Missing required field: " .. field
    end
  end
  
  -- Validate port is a number
  if type(db_config.port) ~= "number" then
    return false, "Port must be a number"
  end
  
  -- Validate instance_name format (project:region:instance)
  local parts = {}
  for part in db_config.instance_name:gmatch("[^:]+") do
    table.insert(parts, part)
  end
  
  if #parts ~= 3 then
    return false, "Instance name must be in format: project:region:instance"
  end
  
  return true, nil
end

return M
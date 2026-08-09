-- Compatibility shim for Neovim 0.12+ tree-sitter query handlers.
--
-- Neovim 0.12 removed the legacy `all = false` mode of
-- `vim.treesitter.query.add_predicate()` / `add_directive()`. Handlers are now
-- always passed captures as *lists* of nodes (`table<integer, TSNode[]>`).
--
-- Plugins written against the old API register with `{ all = false }` and index
-- `match[capture_id]` as a single `TSNode`, which now fails with:
--   attempt to call method 'range' (a nil value)
--
-- The archived `master` branch of nvim-treesitter still does this in
-- `nvim-treesitter/query_predicates.lua` (`set-lang-from-info-string!`,
-- `set-lang-from-mimetype!`, `downcase!`, `nth?`, `is?`, `kind-eq?`), which
-- breaks markdown fenced-code-block injections (seen via markview.nvim).
--
-- This restores the wrapper Neovim used to apply internally: handlers registered
-- with `all = false` keep receiving a single node per capture (the last one,
-- matching Neovim's own former behaviour).
--
-- Must be loaded *before* any plugin registers its handlers, hence it is
-- required from `init.lua` ahead of `lazy_setup`.
--
-- TODO: remove once nvim-treesitter is migrated to its `main` branch (the
-- `master` branch is archived and unmaintained).

if vim.fn.has "nvim-0.12" ~= 1 then return end

local query = require "vim.treesitter.query"

---Wrap a legacy handler so it receives one node per capture instead of a list.
---@param handler function
---@return function
local function wrap_legacy_handler(handler)
  return function(match, pattern, source, predicate, metadata)
    local single = {}
    for capture_id, nodes in pairs(match) do
      if type(capture_id) == "number" and type(nodes) == "table" then
        single[capture_id] = nodes[#nodes]
      else
        single[capture_id] = nodes
      end
    end
    return handler(single, pattern, source, predicate, metadata)
  end
end

---@param fn_name "add_predicate"|"add_directive"
local function patch(fn_name)
  local original = query[fn_name]
  if type(original) ~= "function" then return end

  query[fn_name] = function(name, handler, opts)
    if type(opts) == "table" and opts.all == false then
      local patched_opts = {}
      for k, v in pairs(opts) do
        patched_opts[k] = v
      end
      patched_opts.all = nil
      return original(name, wrap_legacy_handler(handler), patched_opts)
    end
    return original(name, handler, opts)
  end
end

patch "add_predicate"
patch "add_directive"

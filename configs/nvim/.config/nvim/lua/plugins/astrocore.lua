-- if true then return {} end -- WARN: REMOVE THIS LINE TO ACTIVATE THIS FILE

-- AstroCore provides a central place to modify mappings, vim options, autocommands, and more!
-- Configuration documentation can be found with `:h astrocore`
-- NOTE: We highly recommend setting up the Lua Language Server (`:LspInstall lua_ls`)
--       as this provides autocomplete and documentation while editing

---@type LazySpec
return {
  "AstroNvim/astrocore",
  ---@type AstroCoreOpts
  opts = {
    -- Configure core features of AstroNvim
    features = {
      large_buf = { size = 1024 * 500, lines = 10000 }, -- set global limits for large files for disabling features like treesitter
      autopairs = true, -- enable autopairs at start
      cmp = true, -- enable completion at start
      diagnostics_mode = 3, -- diagnostic mode on start (0 = off, 1 = no signs/virtual text, 2 = no virtual text, 3 = on)
      highlighturl = true, -- highlight URLs at start
      notifications = true, -- enable notifications at start
    },
    -- Diagnostics configuration (for vim.diagnostics.config({...})) when diagnostics are on
    diagnostics = {
      virtual_text = true,
      underline = true,
    },
    -- vim options can be configured here
    options = {
      opt = { -- vim.opt.<key>
        relativenumber = true, -- sets vim.opt.relativenumber
        number = true, -- sets vim.opt.number
        spell = false, -- sets vim.opt.spell
        signcolumn = "yes", -- sets vim.opt.signcolumn to yes
        wrap = false, -- sets vim.opt.wrap
        textwidth = 120,
      },
      g = { -- vim.g.<key>
        -- configure global vim variables (vim.g)
        -- NOTE: `mapleader` and `maplocalleader` must be set in the AstroNvim opts or before `lazy.setup`
        -- This can be found in the `lua/lazy_setup.lua` file
      },
    },
    -- Mappings can be configured through AstroCore as well.
    -- NOTE: keycodes follow the casing in the vimdocs. For example, `<Leader>` must be capitalized
    mappings = {
      v = {
      },
      -- first key is the mode
      n = {
        -- second key is the lefthand side of the map
        -- Navigate buffer tabs with `H` and `L`
        L = { function() require('astrocore.buffer').nav(vim.v.count1) end, desc = "Navigate to next buffer in tabs" },
        H = { function() require('astrocore.buffer').nav(-vim.v.count1) end, desc = "Navigate to previous buffer in tabs"  },

        -- Diagnostic
        ["<Leader>dj"] = { function() vim.diagnostic.goto_next({buffer=0}) end, desc = "GotoNextError"},
        ["<Leader>dk"] = { function() vim.diagnostic.goto_prev({buffer=0}) end, desc = "GotoPrevError"},

        -- https://github.com/akinsho/flutter-tools.nvim/blob/main/lua/flutter-tools.lua
        -- Flutter
        ["<Leader>F"] = { desc = "Flutter"},
        ["<Leader>Fc"] = { function() require('telescope').extensions.flutter.commands() end, desc = "Commands"},
        ["<Leader>Fq"] = { function() require("flutter-tools.commands").quit() end, desc = "Quit"},
        ["<Leader>FR"] = { function() require("flutter-tools.commands").restart() end, desc = "Restart"},
        ["<Leader>Fr"] = { function() require("flutter-tools.commands").reload() end, desc = "Reload"},
        -- ["<Leader>Ff"] = { function() os.execute('dart format --line-length 120 .') end, desc = "Format"},

        ["<Leader>Fd"] = { function() require("flutter-tools.devices").list_devices() end, desc = "List Devices"},
        ["<Leader>Fe"] = { function() require("flutter-tools.devices").list_emulators() end, desc = "List Emulators"},

        ["<Leader>Ft"] = { function() require("flutter-tools.commands").open_dev_tools() end, desc = "Open Dev Tools"},
        ["<Leader>Fg"] = { function() require("flutter-tools.commands").pub_get() end, desc = "PubGet"},

        -- Remove lockfile when flutter run does not shutdown correctly
        ["<Leader>FD"] = {
          function()
            local handle = io.popen('dirname $(readlink $(which flutter))')
            if handle == nil then
              print("Could not delete lock file, no handle to shell")
              return
            end
            local output = handle:read('*a')
            local flutter_bin_path = output:gsub('[\n\r]', '') -- remove newlines
            local lock_file_path = flutter_bin_path .. '/cache/lockfile'

            handle:close()
            if (output  ~= nil and output ~= '') then
              os.execute('rm  ' .. lock_file_path)
              -- print('rm  ' .. lock_file_path)
            end
          end,
          desc = "Delete Lock File"},

        -- mappings seen under group name "Buffer"
        ["<Leader>bd"] = {
          function()
            require("astroui.status.heirline").buffer_picker(
              function(bufnr) require("astrocore.buffer").close(bufnr) end
            )
          end,
          desc = "Close buffer from tabline",
        },

        -- tables with just a `desc` key will be registered with which-key if it's installed
        -- this is useful for naming menus
        -- ["<Leader>b"] = { desc = "Buffers" },

        -- setting a mapping to false will disable it
        -- ["<C-S>"] = false,
      },
    },
  },
}

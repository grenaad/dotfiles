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
        -- tables with just a `desc` key will be registered with which-key if it's installed
        -- this is useful for naming menus
        -- ["<Leader>b"] = { desc = "Buffers" },

        -- setting a mapping to false will disable it
        -- ["<C-S>"] = false,
      v = { -- Visual mode

          ["<Leader>jf"] = { "<cmd>'<,'>!jq .<CR>", noremap = true, silent = true, desc = "Format selected lines to json",},
          ["<Leader>tt"] = {
              function()
                  local trim_spaces = true
              -- single_line, visual_lines, visual_selection    
                require("toggleterm").send_lines_to_terminal("visual_lines", trim_spaces, { args = vim.v.count })
              end,
            desc = "Toggle terminal"},
      },
      i = { -- Insert mode
        -- ["<Leader>pu"] = {  "<c-u> :trim(system('uuidgen'))<cr>", noremap = true, silent = true, desc = "Generate UUID",},
        --
      },
      t = { -- Terminal mode
        ["<C-t>"] = { "<Cmd>ToggleTerm<CR>", desc = "Toggle terminal" },
      },
      n = { -- Normal mode
-- ToggleTerm
        ["<Leader>tt"] = { '<Cmd>execute v:count . "ToggleTerm"<CR>', desc = "Toggle terminal" },
        ["<Leader>tb"] = {
          function()
            require("astrocore").toggle_term_cmd { cmd = "btm", direction = "float" }
          end, desc = "ToggleTerm btm" },
-- Buffers
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
-- Gitlinker
        ["<Leader>gy"] = {
          -- Reference:
          -- https://github.com/linrongbin16/gitlinker.nvim/blob/542f51784f20107ef9ecdadc47825204837efed5/minimal_init/lazy_api.lua
         function()
            require("gitlinker").link({
              action = require("gitlinker.actions").clipboard,
              router_type = "current_branch",
            })
          end,
          desc = "Copy repo link",
        },
        ["<Leader>gY"] = {
          function()
            require("gitlinker").link({
              action = require("gitlinker.actions").clipboard,
              router_type = "default_branch",
            })
          end,
          desc = "Copy repo link for default branch",
        },
-- Golang
        ["<Leader>G"] = { desc = "Golang"},
        ["<Leader>Gj"] = { function() require('go.tags').add('json') end, desc = "Add json tag to Go struct",},
        ["<Leader>Gt"] = { "<cmd>GoTestFunc<CR>", desc = "Run Test Func",},
        ["<Leader>GT"] = {"<cmd>GoTestFile<CR>", desc = "Run Test File",},
        ["<Leader>Ge"] = { "<cmd>GoIfErr<CR>", desc = "Generate if err", },
        ["<Leader>Gf"] = { function() vim.cmd("GoFillStruct") end, desc = "Fill Struct",},
        ["<Leader>GF"] = { "<cmd>GoFillSwitch<CR>", desc = "Fill Switch",},
-- http kulala
        ["<Leader>r"] = { desc = "HTTP Request"},
        ["<Leader>ra"] = { function() require('kulala').run_all() end, desc = "Run all requests", },
        ["<Leader>rr"] = { function() require('kulala').run() end, desc = "Run current request", },
        ["<Leader>ri"] = { function() require('kulala').inspect() end, desc = "Inspect current request", },
        ["<Leader>rs"] = { function() require('kulala').show_stats() end, desc = "Show stats of response", },
        ["<Leader>rc"] = { function() require('kulala').copy() end, desc = "Copy request as Curl to clipboard", },
        ["<Leader>rt"] = { function() require('kulala').toggle_view() end, desc = "Toggles body and headers view", },
        ["<Leader>rn"] = { function() require('kulala').jump_next() end, desc = "Jumps to next request",},
        ["<Leader>rp"] = { function() require('kulala').jump_prev() end, desc = "Jumps to prev request", },
        ["<Leader>ru"] = { function() require('kulala').close() end, desc = "Quits buffer and response window", },
-- Metals
        -- ["<Leader>m"] = { desc = "Metals"},
-- DBUI
        ["<leader>D"] = { desc = "󰆼 Db Tools" },
        ["<leader>DD"] = { "<cmd>DBUIToggle<cr>", desc = " DB UI Toggle" },
        ["<leader>Df"] = { "<cmd>DBUIFindBuffer<cr>", desc = " DB UI Find buffer" },
        ["<leader>Dr"] = { "<cmd>DBUIRenameBuffer<cr>", desc = " DB UI Rename buffer" },
        ["<leader>Dl"] = { "<cmd>DBUILastQueryInfo<cr>", desc = " DB UI Last query infos" },
        ["<leader>Dd"] = { desc = "󱘖 Connect" },

        -- Format json
        ["<Leader>j"] = { desc = "Json"},
        ["<Leader>jf"] = { "<cmd>:%!jq .<CR>", noremap = true, silent = true, desc = "Format file to json",},
        ["<Leader>ju"] = { "<cmd>:read!uuidgen<cr>", noremap = true, silent = true, desc = "Generate UUID",},

        ["<Leader>m"] = { desc = "Harpoon"},
        ["<Leader>ma"] = { function() require("harpoon"):list():add() end, desc = "Add", },
        ["<Leader>mm"] = { function() require("harpoon").ui:toggle_quick_menu(require("harpoon"):list()) end, desc = "QuickMenu", },
        ["<Leader>m1"] = { function() require("harpoon"):list():select(1) end, desc = "Select 1", },
        ["<Leader>m2"] = { function() require("harpoon"):list():select(2) end, desc = "Select 2", },
        ["<Leader>m3"] = { function() require("harpoon"):list():select(3) end, desc = "Select 3", },
        ["<Leader>mp"] = { function() require("harpoon"):list():prev() end, desc = "Buffer Prev", },
        ["<Leader>mn"] = { function() require("harpoon"):list():next() end, desc = "Buffer Next", },

        -- NeoTest
        ["<Leader>TT"] = { function() require("neotest").run.run() end, desc = "Run nearest test", },
        ["<Leader>Tf"] = { function() require("neotest").run.run(vim.fn.expand("%")) end, desc = "Run current file", },
        ["<Leader>Ts"] = { function() require("neotest").summary.toggle() end, desc = "Toggle test summary", },
        ["<Leader>To"] = { function() require("neotest").output.open({ enter = true, auto_close = true }) end, desc = "Show test output", },
        ["<Leader>Td"] = { function() require("neotest").run.run({strategy = "dap"}) end, desc = "Debug nearest test", },

-- Open lsp references in telescope
        grr = {function () require('telescope.builtin').lsp_references() end , desc="Telescope References"}
    --   url = function()
    --     local result = vim.fn.system('./database.sh prod_autobots')
    --     return result
    --   end
        },
      },
    },
  }

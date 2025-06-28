return {
  "AstroNvim/astrocore",
  ---@type AstroCoreOpts
  opts = {
    setup_handlers = {
      -- Flutter tools
      dartls = function(_, dartls_opts)
        require("flutter-tools").setup({ lsp = dartls_opts })
      end,
    },
    -- Configure project root detection, check status with `:AstroRootInfo`
    rooter = {
      -- list of detectors in order of prevalence, elements can be:
      --   "lsp" : lsp detection
      --   string[] : a list of directory patterns to look for
      --   fun(bufnr: integer): string|string[] : a function that takes a buffer number and outputs detected roots
      detector = {
        "lsp", -- highest priority is getting workspace from running language servers
        { "pyproject.toml", "pubspec.yaml", ".git", "_darcs", ".hg", ".bzr", ".svn" }, -- next check for a version controlled parent directory
        { "lua", "MakeFile", "package.json" }, -- lastly check for known project root files
      },
      -- ignore things from root detection
      ignore = {
        servers = {}, -- list of language server names to ignore (Ex. { "efm" })
        dirs = {}, -- list of directory patterns (Ex. { "~/.cargo/*" })
      },
      -- automatically update working directory (update manually with `:AstroRoot`)
      autochdir = true,
      -- scope of working directory to change ("global"|"tab"|"win")
      scope = "global",
      -- show notification on every working directory change
      notify = false,
    },

    mappings = {
      n = {
        -- Buffer navigation
        ["]b"] = {
          function()
            require("astrocore.buffer").nav(vim.v.count1)
          end,
          desc = "Next buffer",
        },
        ["[b"] = {
          function()
            require("astrocore.buffer").nav(-vim.v.count1)
          end,
          desc = "Previous buffer",
        },
        ["<Leader>bd"] = {
          function()
            require("astroui.status.heirline").buffer_picker(function(bufnr)
              require("astrocore.buffer").close(bufnr)
            end)
          end,
          desc = "Close buffer from tabline",
        },
        L = {
          function()
            require("astrocore.buffer").nav(vim.v.count1)
          end,
          desc = "Navigate to next buffer in tabs",
        },
        H = {
          function()
            require("astrocore.buffer").nav(-vim.v.count1)
          end,
          desc = "Navigate to previous buffer in tabs",
        },
        -- Diagnostics
        ["<Leader>dj"] = {
          function()
            vim.diagnostic.goto_next({ buffer = 0 })
          end,
          desc = "GotoNextError",
        },
        ["<Leader>dk"] = {
          function()
            vim.diagnostic.goto_prev({ buffer = 0 })
          end,
          desc = "GotoPrevError",
        },
        -- JSON utilities
        ["<Leader>j"] = { desc = "Json" },
        ["<Leader>jf"] = { "<cmd>:%!jq .<CR>", noremap = true, silent = true, desc = "Format file to json" },
        ["<Leader>ju"] = { "<cmd>:read!uuidgen<cr>", noremap = true, silent = true, desc = "Generate UUID" },
      },
      v = {
        -- JSON formatting for visual selection
        ["<Leader>jf"] = {
          "<cmd>'<,'>!jq .<CR>",
          noremap = true,
          silent = true,
          desc = "Format selected lines to json",
        },
      },
    },
  },
}

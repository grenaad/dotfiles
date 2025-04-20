return {
  { "akinsho/flutter-tools.nvim", lazy = true }, -- add lsp plugin
  {
    "AstroNvim/astrolsp",
    ---@param opts AstroLSPOpts
    opts = function(plugin, opts)
      opts.servers = opts.servers or {}
      table.insert(opts.servers, "dartls")
      opts = require("astrocore").extend_tbl(opts, {
        setup_handlers = {
          -- add custom handler
          dartls = function(_, dartls_opts)
            require("flutter-tools").setup({ lsp = dartls_opts })
          end,
        },
        config = {
          -- TODO: setup dap
          -- https://medium.com/indian-coder/supercharge-flutter-with-neovim-a-complete-setup-guide-cbe5cbf5b073

          -- WARN: overwrites astrolsp table
          --
          -- dartls = {
          --   -- any changes you want to make to the LSP setup, for example
          --   color = {
          --     enabled = true,
          --   },
          --   settings = {
          --     dart = {
          --       -- lineLength = 120,
          --       lineLength = vim.o.textwidth
          --     },
          --     showTodos = true,
          --     completeFunctionCalls = true,
          --   },
          -- },
        },
      })
    end,
  },
}

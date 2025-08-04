return {
  "nvim-neotest/neotest",
  dependencies = {
    "nvim-neotest/nvim-nio",
    "nvim-lua/plenary.nvim",
    "antoinemadec/FixCursorHold.nvim",
    "nvim-treesitter/nvim-treesitter",
    "nvim-neotest/neotest-python",
    "nvim-neotest/neotest-go",
  },
  config = function()
      local neotest = require("neotest")
      neotest.setup({
        adapters = {
          require("neotest-python")({
            dap = { justMyCode = false },
            runner = "pytest",
          }),
          require("neotest-go")({
            experimental = {
              test_table = true,
            },
            args = { "-count=1", "-timeout=60s" }
          }),
        },
      })
    end,
  specs = {
    {
      "AstroNvim/astrocore",
      opts = {
        mappings = {
          n = {
            ["<Leader>TT"] = {
              function()
                require("neotest").run.run()
              end,
              desc = "Run nearest test",
            },
            ["<Leader>Tf"] = {
              function()
                require("neotest").run.run(vim.fn.expand("%"))
              end,
              desc = "Run current file",
            },
            ["<Leader>Ts"] = {
              function()
                require("neotest").summary.toggle()
              end,
              desc = "Toggle test summary",
            },
            ["<Leader>To"] = {
              function()
                require("neotest").output.open({ enter = true, auto_close = true })
              end,
              desc = "Show test output",
            },
            ["<Leader>Td"] = {
              function()
                require("neotest").run.run({ strategy = "dap" })
              end,
              desc = "Debug nearest test",
            },
          },
        },
      },
    },
  },
}


---@type LazySpec
return {
  {

    "mistweaverco/kulala.nvim",
    opts = {
      default_view = "headers_body",
      kulala_keymaps = {
        ["Show verbose"] = { "<C-v>", function() require("kulala.ui").show_verbose() end, },
      },
    },
  },
  {
    "AstroNvim/astrocore",
    opts = {
      mappings = {
        n = {
          ["<Leader>r"] = { desc = "HTTP Request" },
          ["<Leader>ra"] = {
            function()
              require("kulala").run_all()
            end,
            desc = "Run all requests",
          },
          ["<Leader>rr"] = {
            function()
              require("kulala").run()
            end,
            desc = "Run current request",
          },
          ["<Leader>ri"] = {
            function()
              require("kulala").inspect()
            end,
            desc = "Inspect current request",
          },
          ["<Leader>rs"] = {
            function()
              require("kulala").show_stats()
            end,
            desc = "Show stats of response",
          },
          ["<Leader>rc"] = {
            function()
              require("kulala").copy()
            end,
            desc = "Copy request as Curl to clipboard",
          },
          ["<Leader>rt"] = {
            function()
              require("kulala").toggle_view()
            end,
            desc = "Toggles body and headers view",
          },
          ["<Leader>rn"] = {
            function()
              require("kulala").jump_next()
            end,
            desc = "Jumps to next request",
          },
          ["<Leader>rp"] = {
            function()
              require("kulala").jump_prev()
            end,
            desc = "Jumps to prev request",
          },
          ["<Leader>ru"] = {
            function()
              require("kulala").close()
            end,
            desc = "Quits buffer and response window",
          },
        },
      },
    },
  },
}

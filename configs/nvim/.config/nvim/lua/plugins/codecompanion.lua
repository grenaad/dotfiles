-- if true then
--   return {}
-- end -- WARN: REMOVE THIS LINE TO ACTIVATE THIS FILE

return {
  "olimorris/codecompanion.nvim",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "nvim-treesitter/nvim-treesitter",
  },
  opts = {
    strategies = {
      -- Change the default chat adapter
      chat = {
        adapter = "anthropic",
      },
      inline = {
        adapter = "anthropic",
      },
      cmd = {
        adapter = "anthropic",
      },
    },
    adapters = {
      openapi = function()
        return require("codecompanion.adapters").extend("anthropic", {
          env = {
            api_key = os.getenv("ANTHROPIC_API_KEY"),
          },
          schema = {
            model = {
              -- default = "gpt-4.1",
              -- default = "gpt-4.1-mini",
              --
              -- claude-sonnet-4-20250514, claude-opus-4-20250514
              default = "claude-sonnet-4-20250514",
            },
          },
        })
      end,
    },
  },
  specs = {
    {
      "AstroNvim/astrocore",
      opts = {
        mappings = {
          n = {
            ["<Leader>a"] = { desc = "Codecompanion" },
            ["<Leader>aa"] = { "<cmd>CodeCompanionActions<CR>", desc = "Actions" },
            ["<Leader>ac"] = { "<cmd>CodeCompanionChat Toggle<CR>", desc = "Chat" },
          },
          v = {
            ["<Leader>aa"] = { "<cmd>CodeCompanionActions<CR>", desc = "Actions" },
            ["<Leader>ac"] = { "<cmd>CodeCompanionChat Add<CR>", desc = "Chat" },
          },
        },
      },
    },
  },
}

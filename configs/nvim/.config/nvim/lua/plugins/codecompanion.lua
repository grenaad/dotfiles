return {
  "olimorris/codecompanion.nvim",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "nvim-treesitter/nvim-treesitter",
  },
  opts = {
    log_level = "DEBUG", -- Enable debug logging
    strategies = {
      -- Change the default chat adapter
      chat = {
        adapter = "opencode",
      },
      inline = {
        adapter = "opencode",
      },
      cmd = {
        adapter = "opencode",
      },
    },
    adapters = {
      -- ACP adapters (Agent Client Protocol)
      -- acp = {
      --   opencode = function()
      --     return require("codecompanion.adapters").extend("opencode", {
      --       -- OpenCode ACP adapter configuration
      --     })
      --   end,
      -- },
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

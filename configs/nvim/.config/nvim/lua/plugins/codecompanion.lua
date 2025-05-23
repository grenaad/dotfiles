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
        adapter = "openai",
      },
      inline = {
        adapter = "openai",
      },
      cmd = {
        adapter = "openai",
      },
    },
    adapters = {
      openapi = function()
        return require("codecompanion.adapters").extend("openai", {
          env = {
            api_key = os.getenv("OPENAI_API_KEY"),
          },
          schema = {
            model = {
              -- default = "gpt-4.1",
              -- default = "gpt-4.1-mini",
              default = "o4-mini",
            },
          },
        })
      end,
    }

  },
}

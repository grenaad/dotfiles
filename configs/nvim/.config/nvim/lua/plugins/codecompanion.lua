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
    },
    adapters = {
      openapi = function()
        return require("codecompanion.adapters").extend("openai", {
          env = {
            api_key = os.getenv("OPENAI_API_KEY"),
          },
          schema = {
            model = {
              default = "o4-mini",
            },
          },
        })
      end,
    }

  },
}

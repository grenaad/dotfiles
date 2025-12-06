return {
  "olimorris/codecompanion.nvim",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "nvim-treesitter/nvim-treesitter",
  },
  config = function()
    -- Use config function instead of opts for better control
    require("codecompanion").setup({
      log_level = "DEBUG",
      strategies = {
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
        acp = {
          opencode = function()
            return require("codecompanion.adapters").extend("opencode", {
              commands = {
                default = {
                  "/opt/homebrew/bin/opencode",
                  "acp",
                },
              },
            })
          end,
        },
      },
    })
  end,
  specs = {
    {
      "AstroNvim/astrocore",
      opts = {
        mappings = {
          n = {
            ["<Leader>a"] = { desc = "Codecompanion" },
            ["<Leader>aa"] = { "<cmd>CodeCompanionActions<CR>", desc = "Actions" },
            ["<Leader>ac"] = { "<cmd>CodeCompanionChat Toggle<CR>", desc = "Toggle Chat" },
            ["<Leader>ai"] = { "<cmd>CodeCompanion<CR>", desc = "Inline Assistant" },
            ["<Leader>ap"] = {
              function()
                require("codecompanion").prompt()
              end,
              desc = "Prompts",
            },
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

--- When you quit any Neovim session, it will close an open OpenCode session as well.

local cmd = "opencode --port"
local topts = { win = { position = "right", enter = false } }

return {
  "nickjvandyke/opencode.nvim",
  version = "*",
  dependencies = {
    {
      ---@module "snacks"
      "folke/snacks.nvim",
      opts = {
        input = {},
        terminal = {},
        picker = {},
      },
    },
  },
  init = function()
    ---@type opencode.Opts
    vim.g.opencode_opts = {
      -- Your configuration, if any — see `lua/opencode/config.lua`
      server = {
        start = function() require("snacks.terminal").open(cmd, topts) end,
      },
    }
  end,
  specs = {
    {
      "AstroNvim/astrocore",
      opts = {
        mappings = {
          n = {
            ["<Leader>o"] = { desc = "OpenCode" },
            ["<Leader>oa"] = {
              function()
                require("opencode").ask("@this: ")
              end,
              desc = "Ask about this",
            },
            ["<Leader>os"] = {
              function()
                require("opencode").select()
              end,
              desc = "Select prompt",
            },
            ["<Leader>o+"] = {
              function()
                require("opencode").prompt("@this ")
              end,
              desc = "Add this",
            },
            ["<Leader>ot"] = {
              function()
                require("snacks.terminal").toggle(cmd, topts)
              end,
              desc = "Toggle embedded",
            },
            ["<Leader>on"] = {
              function()
                require("opencode").command("session.new")
              end,
              desc = "New session",
            },
            ["<Leader>oi"] = {
              function()
                require("opencode").command("session.interrupt")
              end,
              desc = "Interrupt session",
            },
            ["<Leader>oA"] = {
              function()
                require("opencode").command("agent.cycle")
              end,
              desc = "Cycle selected agent",
            },
            ["<S-C-u>"] = {
              function()
                require("opencode").command("session.half.page.up")
              end,
              desc = "Messages half page up",
            },
            ["<S-C-d>"] = {
              function()
                require("opencode").command("session.half.page.down")
              end,
              desc = "Messages half page down",
            },

            ["<Leader>ol"] = {
              function()
                return require("opencode").operator("@this ") .. "_"
              end,
              expr = true,
              desc = "OpenCode operator (line)",
            },
            ["<Leader>or"] = {
              function()
                return require("opencode").operator("@this ")
              end,
              expr = true,
              desc = "OpenCode operator (range)",
            },
          },
          x = {
            ["<Leader>o"] = { desc = "OpenCode" },
            ["<Leader>oa"] = {
              function()
                require("opencode").ask("@this: ")
              end,
              desc = "Ask about this",
            },
            ["<Leader>os"] = {
              function()
                require("opencode").select()
              end,
              desc = "Select prompt",
            },
            ["<Leader>o+"] = {
              function()
                require("opencode").prompt("@this ")
              end,
              desc = "Add this",
            },
            ["<Leader>or"] = {
              function()
                return require("opencode").operator("@this ")
              end,
              expr = true,
              desc = "OpenCode operator (range)",
            },
          },
        },
      },
    },
  },
}

--- When you quit any Neovim session, it will close an open OpenCode session as well.

return {
  "NickvanDyke/opencode.nvim",
  dependencies = {
    -- Recommended for `ask()` and `select()`.
    -- Required for `toggle()`.
    { "folke/snacks.nvim", opts = { input = {}, picker = {}, terminal = {} } },
  },
  init = function()
    ---@type opencode.Opts
    vim.g.opencode_opts = {
      -- Your configuration, if any — see `lua/opencode/config.lua`
    }
    vim.opt.autoread = true
  end,
  specs = {
    {
      "AstroNvim/astrocore",
      opts = {
        mappings = {
          n = {
            ["<Leader>O"] = {
              function()
                require("neo-tree.command").execute({ action = "focus" })
              end,
              desc = "Neotree focus",
            },
            ["<Leader>o"] = { desc = "OpenCode" },
            ["<Leader>oa"] = {
              function()
                require("opencode").ask("@this: ", { submit = true })
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
                require("opencode").prompt("@this")
              end,
              desc = "Add this",
            },
            ["<Leader>ot"] = {
              function()
                require("opencode").toggle()
              end,
              desc = "Toggle embedded",
            },
            ["<Leader>oc"] = {
              function()
                require("opencode").command()
              end,
              desc = "Select command",
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
                require("opencode").ask("@this: ", { submit = true })
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
                require("opencode").prompt("@this")
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

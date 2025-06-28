
---@type LazySpec
return {
  "linrongbin16/gitlinker.nvim",
  opts = {
  },
  specs = {
    {
      "AstroNvim/astrocore",
      opts = {
        mappings = {
          n = {
            ["<Leader>gy"] = {
              function()
                require("gitlinker").link({
                  action = require("gitlinker.actions").clipboard,
                  router_type = "current_branch",
                })
              end,
              desc = "Copy repo link",
            },
            ["<Leader>gY"] = {
              function()
                require("gitlinker").link({
                  action = require("gitlinker.actions").clipboard,
                  router_type = "default_branch",
                })
              end,
              desc = "Copy repo link for default branch",
            },
          },
        },
      },
    },
  },
}

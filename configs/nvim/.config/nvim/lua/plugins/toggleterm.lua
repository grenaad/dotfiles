return {
  "akinsho/toggleterm.nvim",
  specs = {
    {
      "AstroNvim/astrocore",
      opts = {
        mappings = {
          n = {
            ["<C-t>"] = { "<Cmd>ToggleTerm<CR>", desc = "Toggle terminal" },
            ["<Leader>tt"] = { '<Cmd>execute v:count . "ToggleTerm"<CR>', desc = "Toggle terminal" },
            ["<Leader>tb"] = {
              function()
                require("astrocore").toggle_term_cmd({ cmd = "btm", direction = "float" })
              end,
              desc = "ToggleTerm btm",
            },
          },
          t = {
            ["<C-t>"] = { "<Cmd>ToggleTerm<CR>", desc = "Toggle terminal" },
          },
          v = {
            ["<Leader>tt"] = {
              function()
                local trim_spaces = true
                -- single_line, visual_lines, visual_selection
                require("toggleterm").send_lines_to_terminal("visual_lines", trim_spaces, { args = vim.v.count })
              end,
              desc = "Toggle terminal",
            },
          },
        },
      },
    },
  },
}
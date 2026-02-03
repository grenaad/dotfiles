if true then
  return {}
end -- WARN: REMOVE THIS LINE TO ACTIVATE THIS FILE

return {
  "olimorris/codecompanion.nvim",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "nvim-treesitter/nvim-treesitter",
  },
  config = function()
    -- Use config function instead of opts for better control
    require("codecompanion").setup({
      opts = {
        log_level = "DEBUG",
      },
      interactions = {
        chat = {
          adapter = "opencode",
        },
      },
      strategies = {
        chat = {
          slash_commands = {
            ["git_files"] = {
              description = "List git files",
              callback = function(chat)
                local handle = io.popen("git ls-files")
                if handle ~= nil then
                  local result = handle:read("*a")
                  handle:close()
                  chat:add_context({ role = "user", content = result }, "git", "<git_files>")
                else
                  return vim.notify("No git files available", vim.log.levels.INFO, { title = "CodeCompanion" })
                end
              end,
              opts = {
                contains_code = false,
              },
            },
          },
        },
      },
    })

    -- Command line abbreviation for quick access
    vim.cmd([[cab cc CodeCompanion]])
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
            -- Inline and Cmd strategies are only for http adapters like Antrhopic or OpenAI
            -- ["<Leader>ai"] = { "<cmd>CodeCompanion<CR>", desc = "Inline Assistant" },

            -- Prompt library shortcuts
            ["<Leader>af"] = { "<cmd>CodeCompanion /fix<CR>", desc = "Fix Code" },
            ["<Leader>ae"] = { "<cmd>CodeCompanion /explain<CR>", desc = "Explain Code" },
            ["<Leader>at"] = { "<cmd>CodeCompanion /tests<CR>", desc = "Generate Tests" },
            ["<Leader>al"] = { "<cmd>CodeCompanion /lsp<CR>", desc = "LSP Diagnostics" },
            ["<Leader>am"] = { "<cmd>CodeCompanion /commit<CR>", desc = "Generate Commit" },
            ["<Leader>aq"] = { "<cmd>CodeCompanionCmd<CR>", desc = "Generate Command" },
            ["<Leader>ag"] = { "<cmd>CodeCompanion /git_files<CR>", desc = "List Git Files" },
          },
          v = {
            ["<Leader>aa"] = { "<cmd>CodeCompanionActions<CR>", desc = "Actions" },
            ["<Leader>ac"] = { "<cmd>CodeCompanionChat Add<CR>", desc = "Chat" },
            -- ["<Leader>ai"] = { ":CodeCompanion", desc = "CodeCompanion inline" },
            ["<leader>ai"] = {
              function()
                -- Exit visual mode to set the '< and '> marks
                local esc = vim.api.nvim_replace_termcodes("<Esc>", true, false, true)
                vim.api.nvim_feedkeys(esc, "x", false)

                vim.schedule(function()
                  local prompt = vim.fn.input("Prompt: ")
                  if prompt ~= "" then
                    vim.cmd("'<,'>CodeCompanion " .. prompt)
                  end
                end)
              end,
              desc = "CodeCompanion inline",
            },
            -- Prompt library shortcuts for selected text
            ["<Leader>af"] = { "<cmd>CodeCompanion /fix<CR>", desc = "Fix Code" },
            ["<Leader>ae"] = { "<cmd>CodeCompanion /explain<CR>", desc = "Explain Code" },
            ["<Leader>at"] = { "<cmd>CodeCompanion /tests<CR>", desc = "Generate Tests" },
            ["<Leader>al"] = { "<cmd>CodeCompanion /lsp<CR>", desc = "LSP Diagnostics" },
            ["<Leader>ag"] = { "<cmd>CodeCompanion /git_files<CR>", desc = "List Git Files" },
          },
        },
      },
    },
  },
}

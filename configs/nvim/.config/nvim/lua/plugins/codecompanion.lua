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

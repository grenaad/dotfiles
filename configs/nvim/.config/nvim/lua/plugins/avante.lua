return {
  "yetone/avante.nvim",
  build = "make",
  event = "VeryLazy",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "MunifTanjim/nui.nvim",
    "nvim-treesitter/nvim-treesitter",
    "nvim-tree/nvim-web-devicons",
    {
      "MeanderingProgrammer/render-markdown.nvim",
      opts = { file_types = { "markdown", "Avante" } },
      ft = { "markdown", "Avante" },
    },
  },
  opts = {
    provider = "opencode",
    -- Disable default keymaps - we set them via astrocore
    mappings = {
      ask = false,
      new_ask = false,
      zen_mode = false,
      edit = false,
      refresh = false,
      focus = false,
      stop = false,
      toggle = { default = false, debug = false, suggestion = false, repomap = false },
      files = { add_current = false, add_all_buffers = false },
      select_model = false,
      select_history = false,
    },
  },
  specs = {
    {
      "AstroNvim/astrocore",
      opts = {
        mappings = {
          n = {
            ["<Leader>a"] = { desc = "Avante" },
            ["<Leader>aa"] = { function() require("avante.api").ask() end, desc = "Ask" },
            ["<Leader>an"] = { function() require("avante.api").ask({ new = true }) end, desc = "New Ask" },
            ["<Leader>ae"] = { function() require("avante.api").edit() end, desc = "Edit" },
            ["<Leader>ar"] = { function() require("avante.api").refresh() end, desc = "Refresh" },
            ["<Leader>at"] = { function() require("avante.api").toggle() end, desc = "Toggle" },
            ["<Leader>af"] = { function() require("avante.api").focus() end, desc = "Focus" },
            ["<Leader>aS"] = { function() require("avante.api").stop() end, desc = "Stop" },
            ["<Leader>az"] = { function() require("avante.api").zen_mode() end, desc = "Zen Mode" },
            ["<Leader>a?"] = { "<cmd>AvanteModels<CR>", desc = "Select Model" },
            ["<Leader>ah"] = { "<cmd>AvanteHistory<CR>", desc = "History" },
            ["<Leader>ac"] = { function() require("avante.api").add_current_buffer_to_chat() end, desc = "Add Current File" },
          },
          v = {
            ["<Leader>aa"] = { function() require("avante.api").ask() end, desc = "Ask" },
            ["<Leader>ae"] = { function() require("avante.api").edit() end, desc = "Edit" },
            ["<Leader>ar"] = { function() require("avante.api").refresh() end, desc = "Refresh" },
          },
        },
      },
    },
  },
}

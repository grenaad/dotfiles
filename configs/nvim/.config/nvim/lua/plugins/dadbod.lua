return {
  "kristijanhusak/vim-dadbod-ui",
  dependencies = {
    "tpope/vim-dadbod",
    "kristijanhusak/vim-dadbod-completion",
  },
  specs = {
    {
      "AstroNvim/astrocore",
      opts = {
        mappings = {
          n = {
            ["<leader>D"] = { desc = "󰆼 Db Tools" },
            ["<leader>DD"] = { "<cmd>DBUIToggle<cr>", desc = " DB UI Toggle" },
            ["<leader>Df"] = { "<cmd>DBUIFindBuffer<cr>", desc = " DB UI Find buffer" },
            ["<leader>Dr"] = { "<cmd>DBUIRenameBuffer<cr>", desc = " DB UI Rename buffer" },
            ["<leader>Dl"] = { "<cmd>DBUILastQueryInfo<cr>", desc = " DB UI Last query infos" },
            ["<leader>Dd"] = { desc = "󱘖 Connect" },
          },
        },
      },
    },
  },
}
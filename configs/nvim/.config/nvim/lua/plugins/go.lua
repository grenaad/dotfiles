---@type LazySpec
return {
{
  "ray-x/go.nvim",
  dependencies = {  -- optional packages
    "ray-x/guihua.lua",
    "neovim/nvim-lspconfig",
    "nvim-treesitter/nvim-treesitter",
  },
  config = function()
    require("go").setup()
  end,
  event = {"CmdlineEnter"},
  ft = {"go", 'gomod'},
  build = ':lua require("go.install").update_all_sync()' -- if you need to install/update all binaries
},
{
  "AstroNvim/astrocore",
  opts = {
    mappings = {
      n = {
        ["<Leader>G"] = { desc = "Golang" },
        ["<Leader>Gj"] = {
          function()
            require("go.tags").add("json")
          end,
          desc = "Add json tag to Go struct",
        },
        ["<Leader>Gt"] = { "<cmd>GoTestFunc<CR>", desc = "Run Test Func" },
        ["<Leader>GT"] = { "<cmd>GoTestFile<CR>", desc = "Run Test File" },
        ["<Leader>Ge"] = { "<cmd>GoIfErr<CR>", desc = "Generate if err" },
        ["<Leader>Gf"] = {
          function()
            vim.cmd("GoFillStruct")
          end,
          desc = "Fill Struct",
        },
        ["<Leader>GF"] = { "<cmd>GoFillSwitch<CR>", desc = "Fill Switch" },
      },
    },
  },
},
}

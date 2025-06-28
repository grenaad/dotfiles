return {
    "ThePrimeagen/harpoon",
    branch = "harpoon2",
    dependencies = { "nvim-lua/plenary.nvim" },
    specs = {
      {
        "AstroNvim/astrocore",
        opts = {
          mappings = {
            n = {
              ["<Leader>m"] = { desc = "Harpoon" },
              ["<Leader>ma"] = {
                function()
                  require("harpoon"):list():add()
                end,
                desc = "Add",
              },
              ["<Leader>mm"] = {
                function()
                  require("harpoon").ui:toggle_quick_menu(require("harpoon"):list())
                end,
                desc = "QuickMenu",
              },
              ["<Leader>m1"] = {
                function()
                  require("harpoon"):list():select(1)
                end,
                desc = "Select 1",
              },
              ["<Leader>m2"] = {
                function()
                  require("harpoon"):list():select(2)
                end,
                desc = "Select 2",
              },
              ["<Leader>m3"] = {
                function()
                  require("harpoon"):list():select(3)
                end,
                desc = "Select 3",
              },
              ["<Leader>mp"] = {
                function()
                  require("harpoon"):list():prev()
                end,
                desc = "Buffer Prev",
              },
              ["<Leader>mn"] = {
                function()
                  require("harpoon"):list():next()
                end,
                desc = "Buffer Next",
              },
            },
          },
        },
      },
    },
}


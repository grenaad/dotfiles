-- herdr-splits.nvim — vim-tmux-navigator equivalent for the herdr multiplexer.
-- Active only inside a herdr pane (HERDR_ENV=1); AstroNvim's smart-splits
-- keeps ownership of <C-h/j/k/l> everywhere else (plain terminals, tmux).
return {
  {
    "lmilojevicc/herdr-splits.nvim",
    cond = vim.env.HERDR_ENV == "1",
    event = "VeryLazy",
    config = function() require("herdr-splits").setup {} end,
    keys = {
      { "<C-h>", function() require("herdr-splits").move_cursor_left() end, desc = "Navigate left" },
      { "<C-j>", function() require("herdr-splits").move_cursor_down() end, desc = "Navigate down" },
      { "<C-k>", function() require("herdr-splits").move_cursor_up() end, desc = "Navigate up" },
      { "<C-l>", function() require("herdr-splits").move_cursor_right() end, desc = "Navigate right" },
    },
  },
  -- AstroNvim core owns mrjones2014/smart-splits.nvim and binds <C-h/j/k/l>.
  -- Disable it inside herdr so the two navigators don't fight.
  {
    "mrjones2014/smart-splits.nvim",
    cond = vim.env.HERDR_ENV ~= "1",
  },
}

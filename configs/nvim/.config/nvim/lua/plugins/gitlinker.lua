
---@type LazySpec
return {
  "ruifm/gitlinker.nvim",
  opts = {
      add_current_line_on_normal_mode = true,                           -- adds current line nr in the url for normal mode
      print_url = true,                                                 -- print the url after performing the action
      mappings = "<leader>gy",                                          -- mapping to call url generation
  },
}


return {
  "nvim-neo-tree/neo-tree.nvim",
  opts = function(_, opts)
    -- Disable the default <Leader>o mapping
    if opts.mappings and opts.mappings.n then
      opts.mappings.n["<Leader>o"] = false
    end
    return opts
  end,
  specs = {
    {
      "AstroNvim/astrocore",
      opts = {
        mappings = {
          n = {
            -- Disable the default <Leader>o mapping for Neotree focus
            -- Opencode will use this mapping instead
            -- <Leader>O is now the neotree focus default
            ["<Leader>o"] = false,
          },
        },
      },
    },
  },
}

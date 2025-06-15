-- if true then return {} end -- WARN: REMOVE THIS LINE TO ACTIVATE THIS FILE

-- AstroCommunity: import any community modules here
-- We import this file in `lazy_setup.lua` before the `plugins/` folder.
-- This guarantees that the specs are processed before any user plugins.

---@type LazySpec
return {
  "AstroNvim/astrocommunity",
  { import = "astrocommunity.pack.lua" },
  { import = "astrocommunity.pack.dart" },
  { import = "astrocommunity.markdown-and-latex.markview-nvim" },
  -- { import = "astrocommunity.completion.avante-nvim" },
  -- {
  --   "yetone/avante.nvim",
  --   opts = {
  --     provider = "claude",
  --     hints = { enabled = false },
  --     providers = {
  --       claude = {
  --         -- claude-sonnet-4-20250514, claude-opus-4-20250514
  --         model = "claude-sonnet-4-20250514",
  --       },
  --       hints = { enabled = false },
  --     },
  --   },
  -- },
  -- { import = "astrocommunity.completion.avante-nvim"},
  -- { import = "astrocommunity.utility.noice-nvim" },
}

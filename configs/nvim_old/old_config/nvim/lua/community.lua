-- if true then return {} end -- WARN: REMOVE THIS LINE TO ACTIVATE THIS FILE

-- AstroCommunity: import any community modules here
-- We import this file in `lazy_setup.lua` before the `plugins/` folder.
-- This guarantees that the specs are processed before any user plugins.

---@type LazySpec
return {
  "AstroNvim/astrocommunity",
  -- { import = "astrocommunity.pack.lua" },
  -- { import = "astrocommunity.recipes.vscode" },
  -- { import = "astrocommunity.pack.dart" },
  { import = "astrocommunity.lsp.nvim-java" },
  { import = "astrocommunity.utility.noice-nvim" },
  { import = "astrocommunity.completion.avante-nvim"},
  { "yetone/avante.nvim",
      opts = {
        provider = "openai",
        openai = {
            model = "gpt-4o-mini", -- "gpt-2o-mini" or "gpt-4o"
          },
        hints = { enabled = false },
      },
 },
  -- import/override with your plugins folder
}


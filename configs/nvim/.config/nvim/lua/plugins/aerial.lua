-- AstroNvim v5 pins aerial.nvim to `^2.2`, whose tree-sitter backend calls
-- `query:iter_matches(..., { all = false })`. Neovim 0.12 removed that option, so
-- captures come back as node lists and aerial crashes with
-- "attempt to call method 'type' (a nil value)" when attaching to a buffer.
--
-- Upstream fixed this in v3.1.0 (commit f93dcee, "remove use of deprecated
-- iter_matches({all = false})"). AstroNvim's own dev branch tracks `^3` as well.
-- v3.0.0 only raised the minimum Neovim version to 0.11, so opts stay compatible.
--
-- TODO: drop this override once AstroNvim stable bumps its aerial pin.

---@type LazySpec
return {
  "stevearc/aerial.nvim",
  version = "^3",
}

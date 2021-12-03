--require("telescope").load_extension("git_worktree")
require('telescope').load_extension('fzy_native')
local actions = require('telescope.actions')
local build_in = require("telescope.builtin")

local M = {}
M.search_dotfiles = function()
    build_in.find_files({
        prompt_title = "< VimRC >",
        cwd = "$HOME/projects/dotfiles/",
    })
end

M.search_work = function()
    build_in.find_files({
        prompt_title = "< VimRC >",
        cwd = "$HOME/work/",
    })
end
M.search_project = function()
    build_in.find_files({
        prompt_title = "< VimRC >",
        cwd = "$HOME/projects/",
    })
end

return M

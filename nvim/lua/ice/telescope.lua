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

M.git_branches = function()
    require("telescope.builtin").git_branches({
        attach_mappings = function(_, map)
            map('i', '<c-d>', actions.git_delete_branch)
            map('n', '<c-d>', actions.git_delete_branch)
            return true
        end
    })
end

return M

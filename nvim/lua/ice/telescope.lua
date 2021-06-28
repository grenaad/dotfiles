--require("telescope").load_extension("git_worktree")
require('telescope').load_extension('fzy_native')

local M = {}
M.search_dotfiles = function()
    require("telescope.builtin").find_files({
        prompt_title = "< VimRC >",
        cwd = "$HOME/projects/dotfiles/",
    })
end

return M

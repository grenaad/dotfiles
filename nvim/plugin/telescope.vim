lua require("ice")

nnoremap <leader>dot :lua require('ice.telescope').search_dotfiles()<CR>
nnoremap <leader>gc :lua require('ice.telescope').git_branches()<CR>

nnoremap <C-p> :lua require('telescope.builtin').git_files()<CR>
nnoremap <C-f> :lua require('telescope.builtin').find_files()<CR>
nnoremap <C-s> :lua require('telescope.builtin').grep_string({ search = vim.fn.input("Grep For > ")})<CR>


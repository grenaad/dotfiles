lua require("ice")

nnoremap <leader>pro :lua require('ice.telescope').search_project()<CR>
nnoremap <leader>wor :lua require('ice.telescope').search_work()<CR>
nnoremap <leader>dot :lua require('ice.telescope').search_dotfiles()<CR>
nnoremap <leader>gc :lua require('ice.telescope').git_branches()<CR>
nnoremap <leader>b :lua require('telescope.builtin').buffers()<CR>

nnoremap <C-p> :lua require('telescope.builtin').git_files()<CR>
nnoremap <C-f> :lua require('telescope.builtin').find_files()<CR>
nnoremap <C-s> :lua require('telescope.builtin').grep_string({ search = vim.fn.input("Grep For > ")})<CR>


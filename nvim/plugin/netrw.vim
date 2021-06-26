
"Keep the current directory and the browsing directory synced. This helps you avoid the move files error.
let g:netrw_keepdir = 0

"Change the size of the Netrw window when it creates a split. I think 30% is fine.
let g:netrw_winsize = 20
let g:netrw_banner = 0 "Hide the banner 

"Change the copy command. Mostly to enable recursive copy of directories.
let g:netrw_localcopydircmd = 'cp -r'

"Highlight marked files in the same way search matches are.
hi! link netrwMarkFile Search

let g:netrw_hide = 1
let g:netrw_liststyle = 3 " tree view, toggle with i for different views

nnoremap <silent> <C-e> :Lexplore<CR>
nnoremap <silent> <M-e> :Lexplore %:p:h<CR>


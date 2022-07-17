" Options
set smartcase

" Set leader to spacebar
nnoremap <SPACE> <Nop>
let mapleader=" "

" Navigating Windows
nnoremap <C-h> :call VSCodeNotify('workbench.action.navigateLeft')<CR>
nnoremap <C-j> :call VSCodeNotify('workbench.action.navigateDown')<CR>
nnoremap <C-k> :call VSCodeNotify('workbench.action.navigateUp')<CR>
nnoremap <C-l> :call VSCodeNotify('workbench.action.navigateRight')<CR>

" Window 
nnoremap <leader>wv :call VSCodeNotify('workbench.action.splitEditorRight')<CR>
nnoremap <leader>ws :call VSCodeNotify('workbench.action.splitEditorDown')<CR>
nnoremap <leader>wh :call VSCodeNotify('workbench.action.splitEditorDown')<CR>
nnoremap <leader>wq :call VSCodeNotify('workbench.action.closeEditorsAndGroup')<CR>
nnoremap <leader>d :call VSCodeNotify('workbench.action.closeActiveEditor')<CR>

" Terminal
nnoremap <leader>tt  :call VSCodeNotify('workbench.action.togglePanel')<CR>
nnoremap <leader>tf  :call VSCodeNotify('terminal.focus')<CR>
nnoremap <leader>tn  :call VSCodeNotify('workbench.action.terminal.new')<CR>

" Tabs
nnoremap <leader>1  :call VSCodeNotify('workbench.action.openEditorAtIndex1')<CR>
nnoremap <leader>2  :call VSCodeNotify('workbench.action.openEditorAtIndex2')<CR>
nnoremap <leader>3  :call VSCodeNotify('workbench.action.openEditorAtIndex3')<CR>
nnoremap <leader>4  :call VSCodeNotify('workbench.action.openEditorAtIndex4')<CR>
nnoremap <leader>5  :call VSCodeNotify('workbench.action.openEditorAtIndex5')<CR>
nnoremap <leader>6  :call VSCodeNotify('workbench.action.openEditorAtIndex6')<CR>
nnoremap <leader>7  :call VSCodeNotify('workbench.action.openEditorAtIndex7')<CR>
nnoremap <leader>8  :call VSCodeNotify('workbench.action.openEditorAtIndex8')<CR>
nnoremap <leader>9  :call VSCodeNotify('workbench.action.openEditorAtIndex9')<CR>

" Other
nnoremap <C-s> :call VSCodeNotify('workbench.action.files.save')<CR>
" nnoremap <leader>p  :call VSCodeNotify('workbench.action.quickOpen')<CR>
nnoremap <leader>e  :call VSCodeNotify('workbench.view.explorer')<CR>
xnoremap <leader>E <Cmd>call VSCodeNotify('workbench.action.focusSidebar')<CR>
nnoremap <leader>r  :call VSCodeNotify('workbench.action.reloadWindow')<CR>


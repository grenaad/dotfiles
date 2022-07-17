
" https://github.com/LunarVim/LunarVim/blob/4625145d0278d4a039e55c433af9916d93e7846a/vscode/settings.vim

" Window 
function! s:split(...) abort
    let direction = a:1
    let file = a:2
    call VSCodeCall(direction == 'h' ? 'workbench.action.splitEditorDown' : 'workbench.action.splitEditorRight')
    if file != ''
        call VSCodeExtensionNotify('open-file', expand(file), 'all')
    endif
endfunction

function! s:splitNew(...)
    let file = a:2
    call s:split(a:1, file == '' ? '__vscode_new__' : file)
endfunction

function! s:closeOtherEditors()
    call VSCodeNotify('workbench.action.closeEditorsInOtherGroups')
    call VSCodeNotify('workbench.action.closeOtherEditors')
endfunction

function! s:manageEditorSize(...)
    let count = a:1
    let to = a:2
    for i in range(1, count ? count : 1)
        call VSCodeNotify(to == 'increase' ? 'workbench.action.increaseViewSize' : 'workbench.action.decreaseViewSize')
    endfor
endfunction

" Simulate same TAB behavior in VSCode
nmap <Tab> :Tabnext<CR>
nmap <S-Tab> :Tabprev<CR>

command! -complete=file -nargs=? Split call <SID>split('h', <q-args>)
command! -complete=file -nargs=? Vsplit call <SID>split('v', <q-args>)
command! -complete=file -nargs=? New call <SID>split('h', '__vscode_new__')
command! -complete=file -nargs=? Vnew call <SID>split('v', '__vscode_new__')
command! -bang Only if <q-bang> == '!' | call <SID>closeOtherEditors() | else | call VSCodeNotify('workbench.action.joinAllGroups') | endif

nnoremap <silent> <C-w>s :call VSCodeNotify('workbench.action.splitEditorRight')<CR>
xnoremap <silent> <C-w>s :call VSCodeNotify('workbench.action.splitEditorRight')<CR>

nnoremap <silent> <C-w>v :call VSCodeNotify('workbench.action.splitEditorDown')<CR>
xnoremap <silent> <C-w>v :call VSCodeNotify('workbench.action.splitEditorDown')<CR>

nnoremap <silent> <C-w>n :call <SID>splitNew('h', '__vscode_new__')<CR>
xnoremap <silent> <C-w>n :call <SID>splitNew('h', '__vscode_new__')<CR>

nnoremap <silent> <C-w>= :<C-u>call VSCodeNotify('workbench.action.evenEditorWidths')<CR>
xnoremap <silent> <C-w>= :<C-u>call VSCodeNotify('workbench.action.evenEditorWidths')<CR>

nnoremap <silent> <C-w>> :<C-u>call <SID>manageEditorSize(v:count, 'increase')<CR>
xnoremap <silent> <C-w>> :<C-u>call <SID>manageEditorSize(v:count, 'increase')<CR>
nnoremap <silent> <C-w>+ :<C-u>call <SID>manageEditorSize(v:count, 'increase')<CR>
xnoremap <silent> <C-w>+ :<C-u>call <SID>manageEditorSize(v:count, 'increase')<CR>
nnoremap <silent> <C-w>< :<C-u>call <SID>manageEditorSize(v:count, 'decrease')<CR>
xnoremap <silent> <C-w>< :<C-u>call <SID>manageEditorSize(v:count, 'decrease')<CR>
nnoremap <silent> <C-w>- :<C-u>call <SID>manageEditorSize(v:count, 'decrease')<CR>
xnoremap <silent> <C-w>- :<C-u>call <SID>manageEditorSize(v:count, 'decrease')<CR>

" Better Navigation
nnoremap <silent> <C-j> :call VSCodeNotify('workbench.action.navigateDown')<CR>
xnoremap <silent> <C-j> :call VSCodeNotify('workbench.action.navigateDown')<CR>
nnoremap <silent> <C-k> :call VSCodeNotify('workbench.action.navigateUp')<CR>
xnoremap <silent> <C-k> :call VSCodeNotify('workbench.action.navigateUp')<CR>
nnoremap <silent> <C-h> :call VSCodeNotify('workbench.action.navigateLeft')<CR>
xnoremap <silent> <C-h> :call VSCodeNotify('workbench.action.navigateLeft')<CR>
nnoremap <silent> <C-l> :call VSCodeNotify('workbench.action.navigateRight')<CR>
xnoremap <silent> <C-l> :call VSCodeNotify('workbench.action.navigateRight')<CR>

" Bind C-/ to vscode commentary
xmap <C-/> <Plug>VSCodeCommentarygv
nmap <C-/> <Plug>VSCodeCommentaryLinegv

nnoremap <silent> <C-w>_ :<C-u>call VSCodeNotify('workbench.action.toggleEditorWidths')<CR>

nnoremap <silent> <Space> :call VSCodeNotify('whichkey.show')<CR>
xnoremap <silent> <Space> :call VSCodeNotify('whichkey.show')<CR>

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

" Terminal
nnoremap <leader>tt  :call VSCodeNotify('workbench.action.togglePanel')<CR>
nnoremap <leader>tf  :call VSCodeNotify('terminal.focus')<CR>
nnoremap <leader>tn  :call VSCodeNotify('workbench.action.terminal.new')<CR>

" Other
" nnoremap <C-s> :call VSCodeNotify('workbench.action.files.save')<CR>
" nnoremap <leader>p  :call VSCodeNotify('workbench.action.quickOpen')<CR>
" nnoremap <leader>e  :call VSCodeNotify('workbench.view.explorer')<CR>
" xnoremap <leader>E  :call VSCodeNotify('workbench.action.focusSidebar')<CR>
" nnoremap <leader>r  :call VSCodeNotify('workbench.action.reloadWindow')<CR>


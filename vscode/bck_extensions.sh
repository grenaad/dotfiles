#!/bin/bash

echo "Copy vscode extensions to the backup file"
code-insiders --list-extensions > ~/projects/dotfiles/vscode/extensions.txt

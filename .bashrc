###### Alias  ######

alias r="ranger"
alias vim="nvim"
alias ga="git add"
alias gc="git commit -m"
alias gp="git push origin master"
alias gpull="git pull origin master"
alias ga="git add"
alias gc="git commit -m"
alias gp="git push origin master"
alias gpull="git pull origin master"
alias youtube-dl_list="youtube-dl -i --yes-playlist https://www.youtube.com/playlist?list="
alias d="cd ~/projects/dotfiles"
alias ed="nvim ~/projects/dotfiles/.bashrc"
alias ev="nvim ~/projects/dotfiles/nvim/init.vim"
alias ..="cd .."
alias ....="cd ../../"
alias mkdir="mkdir -pv"
alias jupyterlab_docker='docker run -p 8888:8888 -e JUPYTER_ENABLE_LAB=yes -v $HOME:/home/jovyan/work jupyter/datascience-notebook start.sh jupyter lab --LabApp.token='
alias jupyterlab='jupyter lab --LabApp.token='
alias java_config='sudo update-alternatives --config java'
alias portainer="docker run -d -p 9000:9000 --restart always -v /var/run/docker.sock:/var/run/docker.sock -v /opt/portainer:/data portainer/portainer"
alias bat="batcat" # batcat if you are on Debian or Ubuntu
# accces with http://localhost:9000 

# kubernetes
alias kc="kubectx"
alias kns="kubens"
alias s="stern"

function f {
	find $1 -name $2 2>/dev/null
}

# Kill any application that is using a giving port
function kill_port {
	kill -9 $(lsof -i TCP:$1 | grep LISTEN | awk '{print $2}')
}

function cd {
    builtin cd "$@" && ls -F
    }

# convert_vid inputfile outputfile
function convert_vid () {
	ffmpeg -i $1 -vcodec libx264 -acodec aac $2.mp4
}

# convert_vid inputfile outputfile
function convert_audio () {
	ffmpeg -i $1 -acodec aac $2.aac
}

function vimz() {
	vim "$(fzf)"
}

function thermal() {
    sudo smbios-thermal-ctl -g  | grep -A1 "Current Thermal Modes:"
    echo "\nSet Thermal Mode:"
    select yn in "Balanced" "Cool_Bottom" "Quiet" "Performance"; do
        case $yn in
            Balanced ) sudo smbios-thermal-ctl --set-thermal-mode balanced; break;;
            Cool_Bottom ) sudo smbios-thermal-ctl --set-thermal-mode cool-bottom; break;;
            Quiet ) sudo smbios-thermal-ctl --set-thermal-mode quiet; break;; 
            Performance ) sudo smbios-thermal-ctl --set-thermal-mode performance; break;;
        esac
    done
}

###### Environment Variables ######

# using 'bat' with color as a preview for 'fzf'
export FZF_DEFAULT_OPTS="--ansi --preview-window 'right:60%' --preview 'bat --color=always --style=header,grid --line-range :300 {}'"
# dotnet core, opt out of dotnet telemetry data
export DOTNET_CLI_TELEMETRY_OPTOUT='true' 
# History Size
export HISTSIZE=10000
###### General Settings ######

# Activate vi mode with <Escape>
set -o vi

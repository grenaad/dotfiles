#!/bin/bash

MYIP=`dig +short myip.opendns.com @resolver1.opendns.com`
DATE=`date +%F`
NAME=$1

sed -i '' "/$1/c\\
$DATE $MYIP $1
" homeworkerIpAddresses.txt

#!/bin/bash
sudo swapoff -a
sudo fallocate -l 20G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

sudo echo "/swapfile    none    swap    sw    0   0"  >> /etc/fstab

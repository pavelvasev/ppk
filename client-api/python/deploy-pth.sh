#!/bin/bash -e

DIR="$(dirname "$(realpath "$0")")"

conf="# this is pth file of PPK project
$DIR
"

echo "$conf"

PDIR=/home/contact/.local/lib/python3.9/site-packages
echo "installing to $PDIR"
echo "$conf" > ppk.pth
install --backup=numbered --no-target-directory ppk.pth "$PDIR/ppk.pth"

#!/bin/bash
# получается это не то чтобы main.sh а main-services.sh
DIR=$(dirname $(readlink -f "$0"))
LOGDIR=./log
mkdir -p $LOGDIR

NWORKERS=5 $DIR/all-main-services.sh 2>&1 | tee $LOGDIR/main.log
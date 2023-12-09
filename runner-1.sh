#!/bin/bash

export NODE_OPTIONS="--max_old_space_size=8192"
export NODE_NO_WARNINGS=1
LOGDIR=./log
mkdir -p $LOGDIR
DIR=$(dirname $(readlink -f "$0"))

env

#VERBOSE=1 
"$DIR/services/runner3/runner3.js" >$LOGDIR/runner-$RUNNER_ID.log 2>$LOGDIR/runner-$RUNNER_ID.err.log


#!/bin/bash

export NODE_OPTIONS="--max_old_space_size=8192"
export NODE_NO_WARNINGS=1

if [ "$NOLOG" == "1" ]; then
  "$DIR/services/runner3/runner3.js"
else
  LOGDIR=./log
  mkdir -p $LOGDIR
  DIR=$(dirname $(readlink -f "$0"))
  
  #VERBOSE=1
  "$DIR/services/runner3/runner3.js" >$LOGDIR/runner-$RUNNER_ID.log 2>$LOGDIR/runner-$RUNNER_ID.err.log
fi

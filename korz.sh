#!/bin/bash

export NODE_OPTIONS="--max_old_space_size=8192 --trace-uncaught "
export NODE_NO_WARNINGS=1
#export VR_HOST=0.0.0.0
$(dirname $0)/services/korzinka/korzinka.js
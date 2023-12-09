#!/bin/bash

export NODE_OPTIONS="--max_old_space_size=8192"
# --inspect"
export NODE_NO_WARNINGS=1
export PPK_PUBLIC_ADDR=$(hostname -i)
#export RUNNER_ID=$(hostname -s)_$SLURM_JOBID
export VERBOSE=1
$(dirname $0)/../services/runner/runner.js
# seq 1 15 | parallel $(dirname $0)/services/runner/runner.js #">" log/runner{}.log
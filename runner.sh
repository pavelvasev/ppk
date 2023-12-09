#!/bin/bash

export NODE_OPTIONS="--max_old_space_size=8192"
export NODE_NO_WARNINGS=1
#$(dirname $0)/services/runner/runner.js
mkdir -p log

#$(dirname $0)/pusha.sh >log/pusha-$SLURM_JOBID-$SLURMD_NODENAME.log 2>log/pusha-$SLURM_JOBID-$SLURMD_NODENAME.err.log &
#sleep 1

export RAM_LIMIT=4200
#seq 1 3 | RUNNER_ID="cpu-runner" GPU_LIMIT=0 parallel $(dirname $0)/services/runner/runner.js ">" log/runner-{}.log &
#seq 1 7 |  GPU_LIMIT=100 parallel RUNNER_ID="gpu-runner-{}" $(dirname $0)/services/runner/runner.js ">" log/runner-gpu-{}.log &

RUNNER_ID="cpu-runner" GPU_LIMIT=400 $(dirname $0)/services/runner/runner.js


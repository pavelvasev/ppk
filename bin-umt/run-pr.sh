#!/bin/bash -ex
# запуск пуши и воркера
# логи таковы что считается что 1 task-а на job-у

# export NODE_NO_WARNINGS=1
# https://unix.stackexchange.com/a/440514

export MOZG_URL=ws://172.16.33.3:10000
export PUSHA_URL=http://$(hostname -i):3333
#export PPK_PUBLIC_ADDR=$(hostname -i)
export RAM_LIMIT=15000 # в мегабайтах
export GPU_LIMIT=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits || echo 0) #
echo using gpu limit $GPU_LIMIT
#echo $PUSHA_PUB_URL
#exit

$(dirname $0)/pusha.sh >log/pusha-$SLURM_JOBID-$SLURMD_NODENAME.log 2>log/pusha-$SLURM_JOBID-$SLURMD_NODENAME.err.log &
sleep 1
$(dirname $0)/runner-1.sh >log/runner-$SLURM_JOBID-$SLURMD_NODENAME.log 2>log/runner-$SLURM_JOBID-$SLURMD_NODENAME.err.log

wait
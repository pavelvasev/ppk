#!/bin/bash -ex
# запуск пуши и воркера
# логи таковы что считается что 1 task-а на job-у

# export NODE_NO_WARNINGS=1
# https://unix.stackexchange.com/a/440514

export MOZG_URL=ws://172.16.33.3:10000
export PUSHA_URL=http://$(hostname -i):3333
#export PPK_PUBLIC_ADDR=$(hostname -i)

export RAM_LIMIT=4000 # в мегабайтах
x=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits || echo 0) #
export GPU_LIMIT=$(expr $x / 8)
echo using gpu limit $GPU_LIMIT
#echo $PUSHA_PUB_URL
#exit

$(dirname $0)/pusha.sh >log/pusha-$SLURM_JOBID-$SLURMD_NODENAME.log 2>log/pusha-$SLURM_JOBID-$SLURMD_NODENAME.err.log &
sleep 1
$(dirname $0)/runner-1.sh >log/runner-$SLURM_JOBID-$SLURMD_NODENAME-g1.log 2>log/runner-$SLURM_JOBID-$SLURMD_NODENAME-g1.err.log &
$(dirname $0)/runner-1.sh >log/runner-$SLURM_JOBID-$SLURMD_NODENAME-g2.log 2>log/runner-$SLURM_JOBID-$SLURMD_NODENAME-g2.err.log &
$(dirname $0)/runner-1.sh >log/runner-$SLURM_JOBID-$SLURMD_NODENAME-g3.log 2>log/runner-$SLURM_JOBID-$SLURMD_NODENAME-g3.err.log &
$(dirname $0)/runner-1.sh >log/runner-$SLURM_JOBID-$SLURMD_NODENAME-g4.log 2>log/runner-$SLURM_JOBID-$SLURMD_NODENAME-g4.err.log &
$(dirname $0)/runner-1.sh >log/runner-$SLURM_JOBID-$SLURMD_NODENAME-g5.log 2>log/runner-$SLURM_JOBID-$SLURMD_NODENAME-g5.err.log &
$(dirname $0)/runner-1.sh >log/runner-$SLURM_JOBID-$SLURMD_NODENAME-g6.log 2>log/runner-$SLURM_JOBID-$SLURMD_NODENAME-g6.err.log &
$(dirname $0)/runner-1.sh >log/runner-$SLURM_JOBID-$SLURMD_NODENAME-g7.log 2>log/runner-$SLURM_JOBID-$SLURMD_NODENAME-g7.err.log &
$(dirname $0)/runner-1.sh >log/runner-$SLURM_JOBID-$SLURMD_NODENAME-g8.log 2>log/runner-$SLURM_JOBID-$SLURMD_NODENAME-g8.err.log &

wait
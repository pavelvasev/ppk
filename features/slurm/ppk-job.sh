#!/bin/bash -ex
# программа для запуска на узле.
# запуск job-ы состоящей из 1 или более раннеров
# параметры: 
# NWORKERS кол-во воркеров
# MOZG_URL адрес системы ws://172.16.33.3:10000
# RAM_LIMIT мегабайт на 1 воркера

# export NODE_NO_WARNINGS=1
# https://unix.stackexchange.com/a/440514

# задается извне
#export MOZG_URL=ws://172.16.33.3:10000
export PUSHA_URL=http://$(hostname -i):3333
export PPK_PUBLIC_ADDR=$(hostname -i)

#export RAM_LIMIT=$SLURM_MEM_PER_CPU # в мегабайтах
#export RAM_LIMIT=16000
echo using ram limit per worker: $RAM_LIMIT
echo using socks lock: $PPK_SOCKS_LOCK

# вернуть когда вернусь к gpu:
#x=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits || echo 0) #
#export GPU_LIMIT=$(expr $x / $NWORKERS)
#echo using gpu limit $GPU_LIMIT

LOGDIR=./log
mkdir -p $LOGDIR
DIR=$(dirname $(readlink -f "$0"))

# вроде бы как пуши больше не нужны...
# "$DIR/../../pusha.sh" >$LOGDIR/pusha-$SLURM_JOBID-$SLURMD_NODENAME.log 2>$LOGDIR/pusha-$SLURM_JOBID-$SLURMD_NODENAME.err.log &
# кстати идея.. если пуша запустилась то уменьшить NWORKERS на 1?..
#sleep 1
for i in $(seq $NWORKERS); do
    #VERBOSE=true
    NOLOG=1 RUNNER_ID=$SLURM_JOBID-$SLURMD_NODENAME-$SLURM_LOCALID-$i "$DIR/../../runner-1.sh" &
    #>$LOGDIR/$RUNNER_ID.log 2>$LOGDIR/$RUNNER_ID.err.log &
done

echo job-started $SLURM_JOBID-$SLURMD_NODENAME

wait
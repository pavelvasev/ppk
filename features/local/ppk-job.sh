#!/bin/bash -ex

#trap 'pkill -P $$' SIGINT SIGTERM
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# программа для запуска на узле.
# запуск job-ы состоящей из 1 или более раннеров
# параметры: 
# NWORKERS кол-во воркеров
# MOZG_URL адрес системы ws://172.16.33.3:10000
# RAM_LIMIT мегабайт на 1 воркера
# JOB_ID идентификатор этой задачи

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

x=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits || echo 0) #
export GPU_LIMIT=$(expr $x / $NWORKERS)
echo using gpu limit $GPU_LIMIT
#echo $PUSHA_PUB_URL
#exit

LOGDIR=./log
mkdir -p $LOGDIR
DIR=$(dirname $(readlink -f "$0"))

#sleep 1
#echo NWORKERS=$NWORKERS
for i in $(seq $NWORKERS); do
    RUNNER_ID=$JOB_ID-$i "$DIR/../../runner-1.sh" &
    # >$LOGDIR/$RUNNER_ID.log 2>$LOGDIR/$RUNNER_ID.err.log &
done

echo job-started $JOB_ID

wait
#!/bin/bash -ex

#srun -n 1 -t 30 --mem-per-cpu=32000 --gres=gpu -p debug ./run-pr.sh&
#srun -p debug -n 1 -t 40 --gres=gpu:k40m:1 --mem-per-cpu=2000 --pty ./run-pr.sh&

srun -p v100 -n 1 -t 40 --gres=gpu:v100:1 --mem-per-cpu=16000 --cpus-per-task=4  --export="ALL,NWORKERS=4,MEM_LIMIT=16000,MOZG_URL=ws://172.16.33.3:10000" ./ppk-job.sh &
sleep 1

squeue -a -u $USER -o "${SQUEUE_FORMAT:-%.9i %.5P %.8j %.8u %.20S %.4T %.9M %.9l %.5D %R}"


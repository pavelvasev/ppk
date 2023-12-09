#!/bin/bash -ex

ssh -t -t u1321@umt.imm.uran.ru "cd /home/u1321/_scratch2/ppk/k2/features/slurm; srun -p v100 -n 100 -t 40 --gres=gpu:v100:1 --mem-per-cpu=16000 --cpus-per-task=4  --export="ALL,NWORKERS=4,MEM_LIMIT=16000,MOZG_URL=ws://172.16.33.3:10000" ./ppk-job.sh"
# squeue -a -u $USER -o "${SQUEUE_FORMAT:-%.9i %.5P %.8j %.8u %.20S %.4T %.9M %.9l %.5D %R}"


#!/bin/bash

srun --verbose --gres=gpu:v100:1 -p v100 -w tesla-a101 bash -c "nvidia-smi -L && env && ./test.py >t1 && sleep 20" &
srun --verbose --gres=gpu:v100:1 -p v100 -w tesla-a101 bash -c "nvidia-smi -L && env && ./test.py >t2 && sleep 20" &

#time ./vis-mesh.py http://127.0.0.1:3333/77 http://127.0.0.1:3333/78 http://127.0.0.1:3333 1000 1000
#echo going to js
#./spawn.js
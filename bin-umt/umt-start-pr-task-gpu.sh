#!/bin/bash -ex

srun -n 1 -t 30 --mem-per-cpu=32000 --gres=gpu ./run-pr.sh&
sleep 1

squeue -a -u $USER -o "${SQUEUE_FORMAT:-%.9i %.5P %.8j %.8u %.20S %.4T %.9M %.9l %.5D %R}"


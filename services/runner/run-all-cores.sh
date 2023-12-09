#!/bin/bash -ex
cores=$(nproc --all)
seq 1 $cores | parallel ./runner.js
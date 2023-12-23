#!/bin/bash

echo 8-comp > fps8.txt
P=1 ./8-comp.js 2>>fps8.txt
P=2 ./8-comp.js 2>>fps8.txt
P=4 ./8-comp.js 2>>fps8.txt
P=5 ./8-comp.js 2>>fps8.txt
P=10 ./8-comp.js 2>>fps8.txt
P=16 ./8-comp.js 2>>fps8.txt
P=20 ./8-comp.js 2>>fps8.txt
P=25 ./8-comp.js 2>>fps8.txt
P=50 ./8-comp.js 2>>fps8.txt
P=100 /8-comp.js 2>>fps8.txt

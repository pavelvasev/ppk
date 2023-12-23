#!/bin/bash

echo 8-comp > fps8.txt
P=1 DN=1000000 ./8-comp.js 2>>fps8.txt
P=2 DN=1000000 ./8-comp.js 2>>fps8.txt
P=4 DN=1000000 ./8-comp.js 2>>fps8.txt
P=5 DN=1000000 ./8-comp.js 2>>fps8.txt
P=10 DN=1000000 ./8-comp.js 2>>fps8.txt
P=16 DN=1000000 ./8-comp.js 2>>fps8.txt
P=20 DN=1000000 ./8-comp.js 2>>fps8.txt
P=25 DN=1000000 ./8-comp.js 2>>fps8.txt
P=50 DN=1000000 ./8-comp.js 2>>fps8.txt
P=100 DN=1000000 ./8-comp.js 2>>fps8.txt

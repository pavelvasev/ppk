#!/bin/bash

echo 7-comp > fps7.txt
P=1 DN=1000000 ./7-comp.js 2>>fps7.txt
P=2 DN=1000000 ./7-comp.js 2>>fps7.txt
P=4 DN=1000000 ./7-comp.js 2>>fps7.txt
P=5 DN=1000000 ./7-comp.js 2>>fps7.txt
P=10 DN=1000000 ./7-comp.js 2>>fps7.txt
P=16 DN=1000000 ./7-comp.js 2>>fps7.txt
P=20 DN=1000000 ./7-comp.js 2>>fps7.txt
P=25 DN=1000000 ./7-comp.js 2>>fps7.txt
P=50 DN=1000000 ./7-comp.js 2>>fps7.txt
P=100 DN=1000000 ./7-comp.js 2>>fps7.txt

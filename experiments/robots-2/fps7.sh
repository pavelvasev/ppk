#!/bin/bash

echo 7-comp > fps7.txt
P=1 ./7-comp.js 2>>fps7.txt
P=2 ./7-comp.js 2>>fps7.txt
P=4 ./7-comp.js 2>>fps7.txt
P=5 ./7-comp.js 2>>fps7.txt
P=10 ./7-comp.js 2>>fps7.txt
P=16 ./7-comp.js 2>>fps7.txt
P=20 ./7-comp.js 2>>fps7.txt
P=25 ./7-comp.js 2>>fps7.txt
P=50 ./7-comp.js 2>>fps7.txt
P=100 ./7-comp.js 2>>fps7.txt

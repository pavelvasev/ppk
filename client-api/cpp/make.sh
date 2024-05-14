#!/bin/bash -e

gcc test-send.cpp mongoose.c -o test-send -lstdc++ -lpthread 
gcc test-recv.cpp mongoose.c -o test-recv -lstdc++ -lpthread 
#-std=c++11

#./test
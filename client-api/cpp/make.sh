#!/bin/bash -e

gcc test.cpp mongoose.c -o test -lstdc++ -lpthread 
gcc test-recv.cpp mongoose.c -o test-recv -lstdc++ -lpthread 
#-std=c++11

#./test
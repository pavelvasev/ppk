#!/bin/bash -e

gcc test-channels.cpp -lstdc++ -lpthread 
# gcc test-recv.cpp mongoose.c -o test-recv -lstdc++ -lpthread 
# -std=c++11

#./test
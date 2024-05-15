#!/bin/bash -e

gcc test.cpp -o test -lstdc++ -lpthread -Iasio-1.30.2/include
#-std=c++11

./test
#!/bin/bash

#export NODE_OPTIONS="--max_old_space_size=8192 --trace-uncaught "
#export NODE_NO_WARNINGS=1
$(dirname $0)/services/promises/promises-srv.js

#$(dirname $0)/services/promises-py/promises-srv.py
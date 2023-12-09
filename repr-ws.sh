#!/bin/bash

# npx http-server --cors --port 8082 &

export NODE_OPTIONS="--max_old_space_size=8192 --trace-uncaught "
export NODE_NO_WARNINGS=1
export VR_HOST=0.0.0.0
$(dirname $0)/services/repr-ws/repr-ws.js
#$(dirname $0)/main/main.js $(readlink --silent -q -f $1)
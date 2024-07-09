#!/bin/bash
# получается это не то чтобы main.sh а main-services.sh

# npx http-server --cors --port 8082 &

export NODE_OPTIONS="--max_old_space_size=8192 --trace-uncaught "
export NODE_NO_WARNINGS=1
export VR_HOST=0.0.0.0
#$(dirname $0)/services/runner/manager/runner-manager.js

#VERBOSE=1 
$(dirname $0)/main/main.js
# короче это запуск с параметром - скриптом который надо выполнять..
# $(readlink --silent -q -f $1)
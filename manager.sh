#!/bin/bash

# npx http-server --cors --port 8082 &

export NODE_OPTIONS="--max_old_space_size=8192 --trace-uncaught "
export NODE_NO_WARNINGS=1
export VR_HOST=0.0.0.0
RUNNER="${RUNNER:-runner}"
#VERBOSE=1
#$(dirname $0)/services/$RUNNER/runner-manager.js
$(dirname $0)/services/runner-manager/runner-manager.js
#$(dirname $0)/main/main.js $(readlink --silent -q -f $1)
#!/bin/bash
# получается это не то чтобы main.sh а main-services.sh

# npx http-server --cors --port 8082 &

export VR_HOST=0.0.0.0

#VERBOSE=1 

python3.9 $(dirname $0)/main.py/main.py

# короче это запуск с параметром - скриптом который надо выполнять..
# $(readlink --silent -q -f $1)
#!/bin/bash
# получается это не то чтобы main.sh а main-services.sh

# trap 'pkill -P $$' SIGINT SIGTERM
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# npx http-server --cors --port 8082 &

export NODE_OPTIONS="--max_old_space_size=8192 --trace-uncaught "
export NODE_NO_WARNINGS=1
export VR_HOST=0.0.0.0
DIR=$(dirname $(readlink -f "$0"))

LOGDIR=./log
mkdir -p $LOGDIR

#export PPK_PUBLIC_ADDR=$(hostname -i)
#$(dirname $0)/services/runner/manager/runner-manager.js

"$DIR/main.sh" &
#$(readlink --silent -q -f $1) &

#sleep 1 
#todo разобраться с таймаутеами handshakeTimeout
sleep 0.5

#VERBOSE=true 
"$DIR/promises.sh" >"$LOGDIR/promises.log" 2>"$LOGDIR/promises.err.log" &
#"$DIR/promises.sh" &

"$DIR/manager.sh" >"$LOGDIR/manager.log" 2>"$LOGDIR/manager.err.log" &
#"$DIR/manager.sh" &
# $(dirname $0)/korz.sh & # вроде как она не очень то и нужна
# ну и пушу уж докучи
"$DIR/pusha.sh" &

"$DIR/repr-ws.sh" &

#sleep 0.5
###### дальнейшее - для визуальной отладки
#"$DIR/services/korzinka/korzinka-cmd.js" runner-info,runner-finished,runner-started,exec-request,task-resolved &
#"$DIR/bin/get-story.js" runner-info,runner-finished,runner-started,exec-request,task-resolved 2>story.log &

#"$DIR/services/korzinka/korzinka-cmd.js" task-assigned &
#"$DIR/bin/get-story.js" task-assigned 2>story.log &

# JUSTSHOW=true "$DIR/visual-monitor.sh"

# надо подождать пока runner-manager запустится
sleep 0.5

echo NWORKERS=$NWORKERS
for i in $(seq $NWORKERS); do
    RUNNER_ID=$i "$DIR/runner-1.sh" &
done

# надо поспать а то менеджер не успевает запуститься и пропускает запросы
sleep 0.5

# метка для F-LOCAL-START
echo "all-started"

wait
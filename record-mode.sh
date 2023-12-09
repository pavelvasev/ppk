#!/bin/bash
# запуск среды в режиме воспроизведения
# replay-mode.sh файл-лога-истории
# если указать перем. окружения PLAYFULL=1 то будет без задержек по времени, а сразу все запишет

export NODE_OPTIONS="--max_old_space_size=8192 --trace-uncaught "
export NODE_NO_WARNINGS=1
export VR_HOST=0.0.0.0
#export PPK_PUBLIC_ADDR=$(hostname -i)
#$(dirname $0)/services/runner/manager/runner-manager.js

$(dirname $0)/main.sh  &

#sleep 1 todo разобраться с таймаутеами handshakeTimeout
sleep 0.2

#$(dirname $0)/manager.sh &
# $(dirname $0)/web.sh &
#$(dirname $0)/korz.sh &
# ну и пушу уж докучи
# $(dirname $0)/pusha.sh &

# $(dirname $0)/bin/send.js "{\"label\":\"create-korzinka\",\"ms\":100000000,\"crit\":[\"runner-info\",\"exec-request\"]}"
#$(dirname $0)/services/korzinka/korzinka-cmd.js runner-info,runner-finished,runner-started,exec-request,task-resolved &

TOPICS=task-assigned,when-all,resolve-promise
$(dirname $0)/services/korzinka/korzinka-cmd.js $TOPICS &
sleep 0.5

#$(dirname $0)/visual-monitor.sh &
#sleep 3
#$(dirname $0)/bin/get-story.js runner-info,runner-finished,runner-started,exec-request,task-resolved 2>story-check.log &
sleep 1
fvar="${1:-story.log}"
echo "recording story to $fvar"

"$(dirname $0)/bin/get-story.js" $TOPICS 2>"$fvar" &

wait
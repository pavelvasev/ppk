#!/bin/bash -e

# npx http-server --cors --port 8082 &

#http-server --cors --port 8000 &

#echo "To start visual debugger, open URL: https://vr.viewlang.ru/vrungel/index.html?src=/vrungel/apps/coview-3/main.cl#{%22vrungel%22:{%22children%22:{%22project%22:{%22children%22:{%22l1%22:{%22children%22:{%22cam%22:{%22params%22:{%22pos%22:[28.56178124693863,38.61612230117709,25.835193421978342],%22center%22:[5.1037389194510006,-6.275714987318253,21.24754408442928]}},%22item%22:{%22params%22:{%22tscale%22:0.0005,%22manual_features%22:[%22show-ppk%22]},%22manual%22:true,%22children%22:{%22_console-log%22:{%22params%22:{%22output%22:%22TREF=%22}}},%22order%22:6}}},%22v1%22:{%22params%22:{%22sources_str%22:%22%22},%22children%22:{%22_area_container_horiz%22:{%22children%22:{%22_area_3d%22:{%22params%22:{%22sources_str%22:%22@l1%22}}}}}}}},%22screen1%22:{%22children%22:{%22rp%22:{%22children%22:{%22_collapsible%22:{%22params%22:{%22expanded%22:true}},%22rrviews_group%22:{%22children%22:{%22of%22:{%22params%22:{%22objects_params%22:[null]}}}}}}}},%22item%22:{%22params%22:{%22url%22:%22http://127.0.0.1:8000/services/visual-monitor/init.cl%22,%22manual_features%22:[%22plugin-from-url%22]},%22manual%22:true,%22order%22:9}}}}"

DIR=$(dirname $(readlink -f "$0"))

"$DIR/http-file-server.sh" &
"$DIR/repr-ws.sh"

#wait
#echo "jobs are"
#jobs -p
# kill $(jobs -p)
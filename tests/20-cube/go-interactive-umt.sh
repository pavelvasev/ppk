#!/bin/bash

pushd ../../
#npx http-server --cors --port 8082 &
#./repr-ws.sh &
# ползем за пейлоадами на сокс-проксю
PPK_SOCKS_LOCK2=socks://127.0.0.1:15000 ./web.sh &
webpid=$!
popd
sleep 2
kill -0 $webpid || (echo "seems web not started, exiting"; exit 1)

echo "click to open:"
URL="https://vr.viewlang.ru/vrungel/index.html?src=/vrungel/apps/coview-3/main.cl#%7B%22vrungel%22%3A%7B%22children%22%3A%7B%22project%22%3A%7B%22children%22%3A%7B%22l1%22%3A%7B%22children%22%3A%7B%22item%22%3A%7B%22params%22%3A%7B%22manual_features%22%3A%5B%22show-cube%22%5D%7D%2C%22manual%22%3Atrue%2C%22order%22%3A3%7D%7D%7D%2C%22v1%22%3A%7B%22params%22%3A%7B%22sources_str%22%3A%22%22%7D%2C%22children%22%3A%7B%22_area_container_horiz%22%3A%7B%22children%22%3A%7B%22_area_3d%22%3A%7B%22params%22%3A%7B%22sources_str%22%3A%22%22%7D%7D%7D%7D%7D%7D%7D%7D%2C%22screen1%22%3A%7B%22children%22%3A%7B%22rp%22%3A%7B%22children%22%3A%7B%22_collapsible%22%3A%7B%22params%22%3A%7B%22expanded%22%3Atrue%7D%2C%22children%22%3A%7B%22_column%22%3A%7B%22children%22%3A%7B%22_manage_export%22%3A%7B%22params%22%3A%7B%22expanded%22%3Afalse%7D%7D%2C%22_manage_main_objects%22%3A%7B%22children%22%3A%7B%22d%22%3A%7B%22children%22%3A%7B%22_column%22%3A%7B%22children%22%3A%7B%22ssr%22%3A%7B%22params%22%3A%7B%22index%22%3A2%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%2C%22rrviews_group%22%3A%7B%22children%22%3A%7B%22of%22%3A%7B%22params%22%3A%7B%22objects_params%22%3A%5Bnull%5D%7D%7D%7D%7D%7D%7D%7D%7D%2C%22item%22%3A%7B%22params%22%3A%7B%22url%22%3A%22http%3A%2F%2F127.0.0.1%3A8000%2Ftests%2F20-cube%2Fcoview-plugin%2Fshow-cube.cl%22%2C%22manual_features%22%3A%5B%22plugin-from-url%22%5D%7D%2C%22manual%22%3Atrue%2C%22order%22%3A9%7D%7D%7D%7D"
echo "$URL"
xdg-open "$URL"

CUBE_SIZE=[1000,1000,1000] PART_SIZE=[1000,1000,20] JOBS=8 UMT=1 ./service2.js

#wait

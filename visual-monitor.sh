#!/bin/bash
# получается это не то чтобы main.sh а main-services.sh

./web.sh &

# npx http-server --cors --port 8082 &
# URL="https://vr.viewlang.ru/vrungel/index.html?src=/vrungel/apps/coview-3/main.cl#{%22vrungel%22:{%22children%22:{%22project%22:{%22children%22:{%22l1%22:{%22children%22:{%22cam%22:{%22params%22:{%22pos%22:[28.56178124693863,38.61612230117709,25.835193421978342],%22center%22:[5.1037389194510006,-6.275714987318253,21.24754408442928]}},%22item%22:{%22params%22:{%22tscale%22:0.0005,%22manual_features%22:[%22show-ppk%22]},%22manual%22:true,%22children%22:{%22_console-log%22:{%22params%22:{%22output%22:%22TREF=%22}}},%22order%22:6}}},%22v1%22:{%22params%22:{%22sources_str%22:%22%22},%22children%22:{%22_area_container_horiz%22:{%22children%22:{%22_area_3d%22:{%22params%22:{%22sources_str%22:%22@l1%22}}}}}}}},%22screen1%22:{%22children%22:{%22rp%22:{%22children%22:{%22_collapsible%22:{%22params%22:{%22expanded%22:true}},%22rrviews_group%22:{%22children%22:{%22of%22:{%22params%22:{%22objects_params%22:[null]}}}}}}}},%22item%22:{%22params%22:{%22url%22:%22http://127.0.0.1:8000/services/visual-monitor/init.cl%22,%22manual_features%22:[%22plugin-from-url%22]},%22manual%22:true,%22order%22:9}}}}"
URL="https://vr.viewlang.ru/vrungel/index.html?src=%2Fvrungel%2Fapps%2Fcoview-3%2Fmain.cl#%7B%22vrungel%22%3A%7B%22children%22%3A%7B%22project%22%3A%7B%22children%22%3A%7B%22l1%22%3A%7B%22children%22%3A%7B%22cam%22%3A%7B%22params%22%3A%7B%22pos%22%3A%5B39.48929414279085%2C10.96499400127113%2C30.618295123491862%5D%2C%22center%22%3A%5B1.3928845405930923%2C1.3758355074958333%2C2.491419694311134%5D%2C%22ortho%22%3Atrue%2C%22ortho_zoom%22%3A86.70543868214294%7D%7D%2C%22item%22%3A%7B%22params%22%3A%7B%22manual_features%22%3A%5B%22show-ppk%22%5D%7D%2C%22manual%22%3Atrue%2C%22children%22%3A%7B%22lin%22%3A%7B%22params%22%3A%7B%22visible%22%3Afalse%7D%7D%2C%22_console-log%22%3A%7B%22params%22%3A%7B%22output%22%3A%22TREF%3D%22%7D%7D%7D%2C%22order%22%3A6%7D%2C%22item_1%22%3A%7B%22params%22%3A%7B%22manual_features%22%3A%5B%22ppk-vid2%22%5D%7D%2C%22manual%22%3Atrue%2C%22order%22%3A7%7D%7D%7D%2C%22v1%22%3A%7B%22params%22%3A%7B%22sources_str%22%3A%22%22%7D%2C%22children%22%3A%7B%22_area_container_horiz%22%3A%7B%22children%22%3A%7B%22_area_3d%22%3A%7B%22params%22%3A%7B%22sources_str%22%3A%22%40l1%22%7D%7D%7D%7D%7D%7D%7D%7D%2C%22screen1%22%3A%7B%22children%22%3A%7B%22rp%22%3A%7B%22children%22%3A%7B%22_collapsible%22%3A%7B%22params%22%3A%7B%22expanded%22%3Atrue%7D%2C%22children%22%3A%7B%22_column%22%3A%7B%22children%22%3A%7B%22_manage_export%22%3A%7B%22params%22%3A%7B%22expanded%22%3Atrue%7D%7D%7D%7D%7D%7D%2C%22rrviews_group%22%3A%7B%22children%22%3A%7B%22of%22%3A%7B%22params%22%3A%7B%22objects_params%22%3A%5Bnull%5D%7D%7D%7D%7D%2C%22_show_visual_tab_recursive_gui%22%3A%7B%22children%22%3A%7B%22_show_sources_params%22%3A%7B%22children%22%3A%7B%22svlist%22%3A%7B%22children%22%3A%7B%22item%22%3A%7B%22children%22%3A%7B%22_collapsible%22%3A%7B%22params%22%3A%7B%22expanded%22%3Atrue%7D%2C%22children%22%3A%7B%22_paint-gui%22%3A%7B%22children%22%3A%7B%22gui_space%22%3A%7B%22children%22%3A%7B%22_gui-tab%22%3A%7B%22children%22%3A%7B%22_column%22%3A%7B%22children%22%3A%7B%22_row%22%3A%7B%22children%22%3A%7B%22add%22%3A%7B%22children%22%3A%7B%22_column%22%3A%7B%22children%22%3A%7B%22ssr%22%3A%7B%22params%22%3A%7B%22index%22%3A5%7D%7D%7D%7D%7D%7D%7D%7D%2C%22_column%22%3A%7B%22children%22%3A%7B%22_paint-gui%22%3A%7B%22children%22%3A%7B%22ssr%22%3A%7B%22params%22%3A%7B%22index%22%3A0%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%2C%22item%22%3A%7B%22params%22%3A%7B%22url%22%3A%22http%3A%2F%2F127.0.0.1%3A8000%2Fservices%2Fvisual-monitor%2Finit.cl%22%2C%22manual_features%22%3A%5B%22plugin-from-url%22%5D%7D%2C%22manual%22%3Atrue%2C%22order%22%3A9%7D%7D%7D%7D"
#URL="https://vr.viewlang.ru/vrungel/index.html?src=%2Fvrungel%2Fapps%2Fcoview-3%2Fmain.cl#%7B%22vrungel%22%3A%7B%22children%22%3A%7B%22project%22%3A%7B%22children%22%3A%7B%22l1%22%3A%7B%22children%22%3A%7B%22cam%22%3A%7B%22params%22%3A%7B%22pos%22%3A%5B6.378882728605635%2C33.52546704372396%2C35.71557825802069%5D%2C%22center%22%3A%5B2.343852830195407%2C-3.173637297824747%2C4.549831341687393%5D%2C%22ortho%22%3Atrue%2C%22ortho_zoom%22%3A10.056289377146364%7D%7D%2C%22item%22%3A%7B%22params%22%3A%7B%22manual_features%22%3A%5B%22show-ppk%22%5D%7D%2C%22manual%22%3Atrue%2C%22children%22%3A%7B%22_console-log%22%3A%7B%22params%22%3A%7B%22output%22%3A%22TREF%3D%22%7D%7D%7D%2C%22order%22%3A6%7D%7D%7D%2C%22v1%22%3A%7B%22params%22%3A%7B%22sources_str%22%3A%22%22%7D%2C%22children%22%3A%7B%22_area_container_horiz%22%3A%7B%22children%22%3A%7B%22_area_3d%22%3A%7B%22params%22%3A%7B%22sources_str%22%3A%22%40l1%22%7D%7D%7D%7D%7D%7D%7D%7D%2C%22screen1%22%3A%7B%22children%22%3A%7B%22rp%22%3A%7B%22children%22%3A%7B%22_collapsible%22%3A%7B%22params%22%3A%7B%22expanded%22%3Atrue%7D%2C%22children%22%3A%7B%22_column%22%3A%7B%22children%22%3A%7B%22_manage_export%22%3A%7B%22params%22%3A%7B%22expanded%22%3Afalse%7D%7D%2C%22_manage_main_objects%22%3A%7B%22children%22%3A%7B%22d%22%3A%7B%22children%22%3A%7B%22_column%22%3A%7B%22children%22%3A%7B%22ssr%22%3A%7B%22params%22%3A%7B%22index%22%3A2%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%2C%22rrviews_group%22%3A%7B%22children%22%3A%7B%22of%22%3A%7B%22params%22%3A%7B%22objects_params%22%3A%5Bnull%5D%7D%7D%7D%7D%2C%22_show_visual_tab_recursive_gui%22%3A%7B%22children%22%3A%7B%22_show_sources_params%22%3A%7B%22children%22%3A%7B%22svlist%22%3A%7B%22children%22%3A%7B%22item%22%3A%7B%22children%22%3A%7B%22_collapsible%22%3A%7B%22params%22%3A%7B%22expanded%22%3Atrue%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%2C%22item%22%3A%7B%22params%22%3A%7B%22url%22%3A%22http%3A%2F%2F127.0.0.1%3A8000%2Fservices%2Fvisual-monitor%2Finit.cl%22%2C%22manual_features%22%3A%5B%22plugin-from-url%22%5D%7D%2C%22manual%22%3Atrue%2C%22order%22%3A9%7D%7D%7D%7D"
#URL="http://localhost:8000/vd"
test -z "$JUSTSHOW$SSH_CONNECTION" && xdg-open "$URL"
echo "$URL"

wait
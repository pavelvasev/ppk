# запуск сервиса

локально
TEST=1 CUBE_SIZE=[1000,1000,1] PART_SIZE=[1000,100,1] JOBS=1 ./service2.js

на умт
CUBE_SIZE=[1000,1000,1000] PART_SIZE=[1000,1000,20] JOBS=12 UMT=1 ./service2.js

# запуск тестов
малый локальный кубик
time TEST=1 CUBE_SIZE=[1000,1000,1] PART_SIZE=[1000,100,1] ./service2.js
малый кубик на умт
time TEST2=1 CUBE_SIZE=[1000,1000,1] PART_SIZE=[1000,100,1] JOBS=12 UMT=1 ./service2.js
полный кубик
time TEST=1 CUBE_SIZE=[1000,1000,1000] PART_SIZE=[1000,1000,20] JOBS=12 UMT=1 ./service2.js
time TEST2=1 CUBE_SIZE=[1000,1000,1000] PART_SIZE=[1000,1000,20] JOBS=12 UMT=1 ./service2.js

полный кубик на слабых узлах
time TEST=1 CUBE_SIZE=[1000,1000,1000] PART_SIZE=[1000,1000,20] JOBS=0 JOBS2=25 UMT=1 ./service2.js

# запуск веб-клиента
http://127.0.0.1:8000/tests/20-cube/coview-plugin/show-cube.cl

просмотр кубика:
https://vr.viewlang.ru/vrungel/index.html?src=%2Fvrungel%2Fapps%2Fcoview-3%2Fmain.cl&state=%7B%22vrungel%22%3A%7B%22children%22%3A%7B%22project%22%3A%7B%22children%22%3A%7B%22l1%22%3A%7B%22children%22%3A%7B%22cam%22%3A%7B%22params%22%3A%7B%22pos%22%3A%5B16.129495895901904%2C18.875262516572544%2C11.782343152662019%5D%2C%22center%22%3A%5B0%2C0%2C0%5D%7D%7D%2C%22item%22%3A%7B%22params%22%3A%7B%22manual_features%22%3A%5B%22show-cube%22%5D%7D%2C%22manual%22%3Atrue%2C%22order%22%3A6%7D%7D%7D%2C%22v1%22%3A%7B%22params%22%3A%7B%22sources_str%22%3A%22%22%7D%2C%22children%22%3A%7B%22_area_container_horiz%22%3A%7B%22children%22%3A%7B%22_area_3d%22%3A%7B%22params%22%3A%7B%22sources_str%22%3A%22%40l1%22%7D%7D%7D%7D%7D%7D%7D%7D%2C%22screen1%22%3A%7B%22children%22%3A%7B%22rp%22%3A%7B%22children%22%3A%7B%22_collapsible%22%3A%7B%22params%22%3A%7B%22expanded%22%3Atrue%7D%2C%22children%22%3A%7B%22_column%22%3A%7B%22children%22%3A%7B%22_manage_main_objects%22%3A%7B%22children%22%3A%7B%22d%22%3A%7B%22children%22%3A%7B%22_column%22%3A%7B%22children%22%3A%7B%22ssr%22%3A%7B%22params%22%3A%7B%22index%22%3A2%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%2C%22rrviews_group%22%3A%7B%22children%22%3A%7B%22of%22%3A%7B%22params%22%3A%7B%22objects_params%22%3A%5Bnull%5D%7D%7D%7D%7D%7D%7D%7D%7D%2C%22item%22%3A%7B%22params%22%3A%7B%22url%22%3A%22http%3A%2F%2F127.0.0.1%3A8000%2Ftests%2F20-cube%2Fcoview-plugin%2Fshow-cube.cl%22%2C%22manual_features%22%3A%5B%22plugin-from-url%22%5D%7D%2C%22manual%22%3Atrue%2C%22order%22%3A9%7D%7D%7D%7D

# алгоритм работы с веб-клиентом

########## show-cube.cl

on coview:camera-change
  послать camera-params

on image
  установить в фон 

########## service.js

on camera-params
 - запоминает положение камеры и т.п в RA
 - инициирует рендеринг посылая сигнал render

on render
- вызывает рендер с параметрами RA
- вызывает джоин
  - джоин последнуюю картинку конвертит в png-массив и кладет в сообщение image

конечно есть вопросы: почему бы не посылать camera-params скока надо?
ответ: потому что у нас render получает на вход положение камеры.  
так что по сути посылка camera-params это команда на рендеринг


# Объемы кубика
1000*1000*50 = 50 млн
каждая точка 3 флоата (координаты) = 3*4 = 12 байт.
итого слайс 50*12*10^6 = 600 млн, 600 мб то бишь.
и поэтому если 2 ниды на воркер то это нещастные 1200 на воркер
и если мы делаем 4 воркера на видеокарту то это нещастные 4800 на жобу.

M2090 6гб
K40m 12гб

но в целом надо понимать что это я лично регулирую, на скольких воркеров делить 1 видеокарту.

и это пока что ток если координаты..
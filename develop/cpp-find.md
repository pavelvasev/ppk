Вопрос: на чем в С++ сделать наш протокол?
Вебсокеты + tcp для обмена сообщениями + с прицелом на UCX (https://openucx.org/documentation/)

----

https://libwebsockets.org/
- вроде класс но низкоуровневое
https://libwebsockets.org/git/libwebsockets/tree/minimal-examples/server/hello_world/main.c

https://github.com/facundofarias/awesome-websockets?tab=readme-ov-file#c-1

---
https://github.com/cesanta/mongoose
 а чем мы лучше MQTT? понятно что большие данные и прямую передачу умеем. а еще?
 
----
монгусь кстати вроде норм. но вопрос конечно, зачем нам вебсокеты. мы можем просто сокетами общаться.
или вот скажем тем же ucx, хотя там в конце концов все просто, но пока выглядит как перебор.

ладно, менять вебсокеты сейчас дело дорогое, пусть будут.
-----
итого mongoose краткие коды, и работает в win и linux и c и с++, и tcp апи дает,
 что немаловажно для windows (там другое апи чем в линукс)

вариант еще MQTT https://habr.com/ru/articles/463669/ 
но MQTT вроде посылка через брокера. Но что интересно там подписка широкая, на подерево или по маске.
Ну да.

https://itechinfo.ru/content/lightweight-m2m
тяжелое

----
https://github.com/Theldus/wsServer
очень мило но будто игрушечное

----
https://github.com/uNetworking/uWebSockets
с++ перебор

----
https://github.com/zaphoyd/websocketpp
нет поддержки чистого tcp
или не надо? но нам нужна винда.. но мб другая бибилотека подойдет?
https://github.com/zaphoyd/websocketpp/blob/master/examples/echo_client/echo_client.cpp
но это сложнее в понимании чем mongoose

------
https://github.com/ithewei/libhv
очень неплохо.. как вариант вместо монгуся
но там много неявного кстати, вот потоки например. хотя мб это и удобно будет

и китайское отсутствие документации

-----
https://github.com/tatsuhiro-t/wslay
нет tcp

----
qtwebsocket
тянет за собой qt-расширения (надо писать про слоты и тп) и это явный перебор для мелких проектов
но можно реализовать отдельно, только для qt

----
https://github.com/machinezone/IXWebSocket
по дизайну похоже на Монгусь. Нет tcp, в принципе приятное

p.s. mongoose оказалось при записи копирует данные. нам не подходит.

-----
mongoose вообще не вариант. mg-wakeup проходит по списку всех соединений, и не только он.

asio вроде вариант.

p.s. и далее https://docs.nvidia.com/doca/archive/doca-v1.5.0/ucx-programming-guide/index.html

+ rcplib
http://rpclib.net/internals/
http://rpclib.net/spec/
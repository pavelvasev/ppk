Насчет протоколов
вот тут пишут что на этом уровне решается задача MxN..
а мы ее как бы вовсе не решаем. это надо отразить.
https://adios2.readthedocs.io/en/latest/engines/engines.html#sst-sustainable-staging-transport
SST is designed for use in HPC environments and can take advantage of RDMA network interconnects to speed the transfer of data between communicating HPC applications; however, it is also capable of operating in a Wide Area Networking environment over standard sockets. SST supports full MxN data distribution, where the number of reader ranks can differ from the number of writer ranks. SST also allows multiple reader cohorts to get access to a writer’s data simultaneously.
...
Current allowed values are “UCX”, “MPI”, “RDMA”, and “WAN”. 
(ib and fabric are accepted as equivalent to RDMA and evpath is equivalent to WAN.)

----
https://github.com/openucx/ucx
Unified Communication X
Unified Communication X (UCX) is an award winning, optimized production proven-communication framework for modern, high-bandwidth and low-latency networks.

UCX exposes a set of abstract communication primitives that utilize the best of available hardware resources and offloads. These include RDMA (InfiniBand and RoCE), TCP, GPUs, shared memory, and network atomic operations.

но мб в целом можно и не увлекаться - пуша же аналог похоже. смогет.

-----
Пуша могла бы пушить в локальную общую память. Или в гпу.

----
А при пуше в другую пушу - просить ее пропушить дальше (следующей пуше или там в память; можно даж у себя не оставлять в этом смысле;
кстати заранее если это понимать то та может направить поток сразу куда надо а не в файл).

По ощущению тут двоякое. Один готовит канал (место) куда запушить, а потом пуше говорят - она пушит.

-----
на каком-то разумном уровне подключить сжатие данных
.pipeThrough(new CompressionStream('gzip'))
https://web.dev/i18n/ru/fetch-upload-streaming/
https://wicg.github.io/compression/
варианты
- на уровне работы с потоками. по сути пишем в поток гзипнутые байты, читаем клиентом разгзипиваем
- на уровне работы с клиент-апи. пришел пейдлоад - сжали. неудобно.
- на уровне апи более высоком. это уже ближе к ОФ.
но в целом - 80 млн байт за секунду.. долго... gzip --fast 302

***************

https://www.opennet.ru/man.shtml?topic=shmget&category=2&russian=0
https://github.com/ukrbublik/shm-typed-array/blob/master/src/node_shm.cc
вот вроде норм библиотека на тему.
ничево не копирует.
но надо создавать массивы специальным образом.

вопрос конечно скорее - как gpu-память оставлять на месте. эта уж во вторую очередь так-то.
ну те.. отрендерили - как ее оставить там где она есть. чтобы потом например merge-join их соединил (будучи скажем написанным на gpu.js). это даже пожалуй что и первичнее.
k2 - версия мая 2023. научили систему запускаться с лок машины с выходом задач на умт.
     было: переколбасиваем систему (менеджер), добавляем новые сервисы и пр.
     
k3 - делаем протокол типа "новое видение API".

k4 - введена языковая среда для воркеров. и сделано 2 среды - js и питон, последняя в форме подпроцесса.

k5 - версия с моделью от конца июня 2023. То есть чтобы условный воркер занимался расчетами по выполнению задач.
     И т.о. решив какую-то задачу сразу же понимал что делать дальше, и делал.
     
k6 - идея реализовать алгоритмы работы с задачами самостоятельно, отдельно, по возможности распределённо
     и переносимо - чтобы их можно было стыковать в цепочки, размещая на разных узлах (увы пока статично).
     Чтобы ими могли бы пользоваться и сами участники, выполнять часть задач адекватных им.
     
k7 - реализуем распределенный граф задач + роботы
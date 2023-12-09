здесь решается задача параллельного счета массива.

DN=1000000 ./0-arr-local.js - обычная последовательная версия
compute: 11    
compute: 11.417s

DN=1000000 ./0-cell-local.js - на каналах но непараллельное
compute: 11.382s

DN=1000000 ./1-arr-par.js - на обычных тасках
compute: 5.031s
compute: 4.372s - без inspect

DN=1000000 ./3-matrix.js - параллельная на задачах матрице 
compute: 4.244s 
compute: 4.535s 
compute: 4.267s
compute: 4.313s
compute: 3.7  - без inspet
compute: 3.765s

DN=1000000 ./2-local-promise.js - параллельная на локальных каналах без задач 

compute: 4.523s 
compute: 3.865s
compute: 3.827s

compute: 3.687s - без инспект
compute: 3.626s
ммм.

ну т.е. у нас разница 100 мс матричной версии и нематричной захардкоденной. это очень круто.

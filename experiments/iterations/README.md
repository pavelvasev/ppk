# Метод итераций для графов задач. Эксперимент.

Вычисляется функция одного переменного на регулярной сетке по явной схеме.
Код функции описан в файле [f.js](f.js)

### Последовательное вычисление
[0-sequential.js](0-sequential.js) 

### Граф задач
[1-task-graph.js](1-task-graph.js) 

### Ручное распараллеливание
[2-manual.js](2-manual.js)

### Метод итераций
[3-iter-graph.js](3-iter-graph.js) 

## Подготовка и запуск теста

```
git clone https://github.com/pavelvasev/ppk.git
cd ppk
git checkout --track origin/pavt2024
npm install
```

Запуск:
```
cd experiments/iterations
./start.sh
```

## Результаты

* 1 млн узлов - размер сетки
* 4 исполнителя
* процессор Ryzen 1700x 

```
===== sequential
compute: 11.343s
===== task-graph
compute: 4.012s
===== manual
compute: 3.557s
===== iter-graph
compute: 3.709s
```

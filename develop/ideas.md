# Идеи и заметки

Вот проблема что сложный протокол - на яваскрипт завязанный. (реакции рассылаются клиентам в этой модели).
1. Произвольный процесс ставит перед собой представителя на js и в него шлет сообщения.
2. Реакции напишем на opcode-ах, т.е. реакция это будет не js код а операция. Ну как у раннеров.
И тогда любой язык любая среда подойдут (но надо реализовать там опкоды будет).
(для компилируемых - ну подгружать длл-ку. но это и нормальнО)
****
кстати нащот корзинки - ее пока нет - можно чтобы клиенты сами все хранили.
(дать им такую реакцию). ну проблема что клиенты отваливаются - тогда переносить
(если получается..)
----
https://iopscience.iop.org/article/10.1088/1742-6596/1607/1/012017/pdf 
- вообще это называется задача планирования, и она популярна. Шарф С.В. её тоже решал. Надо у него спрашивать

****
Мб аргументы реакций вместе с кодом указывать? Потому что ну и некрасиво получается что сначала аргументы а потом код..
Хотя конечно тоже смотрится так себе.. длинный код и затем - аргументы. Но и у rapi.js так, и у exec первого так было.. Ладно попробуем.
Это всегда странно выглядело. Попробую. F-REACTION-ARG-WITH-CODE

****
надо вестимо визуализацию задач сразу делать. кто что где делает, в каком состоянии. ну такой анимационный процесс. можно даже в режиме реплей чтобы посмотреть было.
кстати это неплохо, сразу встроенный реплей. ну как делать - то ли в браузере (типа менеджер или спецсмотрелка дают ссылку на запуск из консоли) то ли в консоли прямо.
ну в 3д в браузере мне проще на удивление.

кстати неплохо это тем, что сразу веб-клиента отладить. хм. ну и да, он может быть частично встроенный - пожалуйста. и кстати заодно задача веб-сервиса как-то решена
будет встроенного (ее надо заново решать).

****
кстати текущая реализация позволяет хорошо отправлять всякие логи - если их не слушают они и не отправляются..
*****
по идее менеджер как бы сам может выглядеть раннером. и в этом смысле быть представителем многих раннеров.
мы ему назначаем задачу - он ее транслирует раннеру.
ну точнее получается мы перед ним ставим раннера а он менеджеру будет передавать.
и тогда всех можно по звезде будет раскидать - в центре суперменеджер а вокруг менеджеры ако раннеры.
но только нюанс - у нас сейчас раннер считается может 1 задачу выполнять. мы от этого отталкиваемся. и это придется пересмотреть 
- тогда там возникнет нагрузка, как у китайцев в работе https://iopscience.iop.org/article/10.1088/1742-6596/1607/1/012017/pdf
которую подсказал Михаил
****
выяснилость что ресурс у менеджера примерно 800 задач в секунду )))) сколько бы воркеров не было.
дальше вижу варианты - рассылать задачи пачками. для этого можно предусмотреть хинт какой-то - что вот эту задачу можно стэковать
на одном раннере с подобными (например по нидсам) в таком-то кол-ве штук и плохо не будет.
ну раннер надо доработать как-то будет что мол ему послали несколько задач.

****
позиционные аргументы можно сделать создав ключ positional для args у задач и нидов.
или типа того, покороче. смысл - все-равно эти коды я буду генерировать функциями.
а в функции можно сделать if (Array.isArray(...)) и тогда это позиционные.. ну что-то такое.
*****
для тестов надо бы сделать run-test который запустит мейна, воркеров, пушу, менеджера - и нужный клиентский скрипт.
и сравнит что тот выдает с тем что надо.
-----
действия у реакций выразить такими же операциями. удобно.
и кстати с реакций снимается требование работать быстро. надо просто понимать где они могут работать окажется, вот и все (но мб это сложно?). в целом - вот сделала счетная програмка кусочек данных и выходит тут же их обработали. благодаря действиям-операциям мы можем хоть длл-ки распространять таким образом.
-----
но вопрос, нужны ли мне операции как сейчас в виде именно ЯП аля лисп?
большой гибкости там не добиться почти..
мб как-то активнее js использовать?
и вообще нужны ли операции как блобы? изначально это появилось изза нидсов. но нидсы можно описывать и так:
{ code: 'js', arg: {text}, need: true}...
и вот у ребят питон в С++ вкручен.
-----
А пусть F-RSR-PRECOMPUTE будет так что вызывается до разворачивания просто очередной ниды / выполнения таски?
*****
Так-то пара в квери action + done крутая. Потому что action это по сути как реакция получается, а done это уже отклик у клиента. И можно их комбинировать - только action например размещать )))
-----
query-with-payload напрашивается..
но кому он нужен опять же.. только веб-клиенту покамест.
*****
раннер-менеджеры параллелятся и корзинки тоже.
для этого можно сделать ток удобство что срабатывает 1 реакция из набора указанного класса.
по рандому или еще как. и тогда задача будет попадать в рандомный раннер-менеджер или в рандомную корзинку.
или можно сделать какие-то метрики для выбора куда класть.
кстати хоть на уровне action у квери.
Ё раннер-менеджерам ток надо будет гуидами ко-задач обмениваться. но если сделать преобразование задач с козадачами на клиенте.. то может и это не потребуется. (я хотел - чтобы раннер-менеджеру мозги не парить, а раннер-менеджер уже ток назначает задачки с нидами без конидов)

**********
"Цена" ресурса это ерунда, т.к. замеры идут по времени на создание. А там например подпрограмма запускается - как измерить? Ну или - ждать ее готовности..

*****
навеяно https://hpx-docs.stellar-group.org/latest/html/manual/writing_distributed_hpx_applications.html#writing-distributed-hpx-applications
дать пользователю возможность указывать на каком раннере запускать задачу.
в этом смысле мб писать напрямую в очередь задач раннера.
вроде как раннер можно реализовать так что он может получать задания из нескольких источников.

вообще, когда я разрешил раненеру принимать много задач и вести свою очередь, я этим ввел как бы рекурсивную схему и это я думаю очень хорошо и удобно. раннер по протоколу вообще может теперь совпадать с менеджером задач. !!!!! а всякие runner-info ну это дополнительное уже, их личное дело.

******
мб таки рассмотреть вариант что пейлоад идет с сообщением. потому что для рендеринга картинки надо скорость.
а если визуализатор получает указатель на блок и идет за ним - это долго выходит (раундтрипы долгие.. задержки..)

****
Idea В конце концов мы можем в сисему класть и промисные выражения — типа просить ее сделать вот простое промисовое вычисление. Например вот асинхнронную очередь обработать. И типа результат — промиса — можно стирать.

Idea И идея сделать мерж парал рендеринга на асинхронных списоках.

Idea Идея разделить операцию пуш на 2. На аллокейт и на пут. Тогда мы сможем сразу же посылать сигнал готовности задачи. И на рендерере — выдать урли и класть (но надо еще очистку будет сообразить ожидания докладывания). Ну и еще пуша должна будет уметь сразу отдавать то что в нее еще пут-ают.

*****
Но главное вот что я понял. Что на ППК история не заканчивается и вот интересно дальше чем заниматься. То ест надо ППК как бы быстрее заканчивать.
Я думаю мне в этом поможет Си++ либа клиентская (причем видимо полноценная а не прокси) и вот Сикл или Кокос. 
Клиентская либа заставит меня вынести реакции в операции (сетенв).
Кокос али Сикль — даст производдительность.
Ну вот и будет полноценное усе. А там дальше — потихоньку компоненты заменять. 
Ну и эксперименты. Мб и правда мне глобальный резолв промисов не нужен и менеджер тогда упрощается (ну и кониды как бы тоже не нужны — промисы же есть). 
Типа если надо промисное выражение пушится в центральный запускатор а он простой. (запускатор который выполняет js-коды, а они уже - отслеживают резолв задач ... резолвят промисы выраженные локально?)

********************
********************
********************

Промисы - это рядовая фича. Ну можно в отдельном сервисе реализовать.
Вообще у нас сервисы это и есть место где реализовывать фичи... (ну плюс клиент апи руками пока патчим)
----
Вообще фишка модели что она расширяемая получается.
----
Кстати до меня дошло почему например мы не запариваемся за однонодовый параллелизим.
Ибо там есть свои оптимизации. Ранше я думал ОпенМП, потом вот что С++ параллельный,
а теперь еще что ну так-то жпу надо прогать. И вот эта магистральная идея что мы делаем раскидыватель задачек на GPU да и все.
----
Кстати мысль вот в HPX объединяют запуски Kernel в одну штучку, а ранее я видел они и сообщения объединяют.
Все это ради того чтобы избежать тормозов т.к кернел по очереди запускать это простои,
сообщения - тоже простои.
Получается что они проводят рантайм-трансляцию в другой род системы. То есть это как компилятор выходит.
Вообще идея тогда - что ну вот у нас на входе некое (поток задач напр) и мы преобразовываем это в более эффективную структуру для низкоуровневой реализации.
С учетом тех же банков памяти например..
----
Кстати нащот потока задач - вообще SYСL-раннер можно сделать который вот будет например задачки как-то эффективно чейнить именно сиклевые.
Ну такой вот компилятор в низкоуровневое.. (рантайм-компилятор..)
компайл это кстати вообще-то собрать..
-----
кстати нам с Мишей попеняли что мол вот задачи процессы запускаете и это дорого. Мы видимо не донесли что процессный параллелизм это выгоднее чем потоковый (изза кешей).
Но опять же запуск задач тогда обязателный был. А теперь все по раннерам и нидам упаковано - хорошо.
The RiDE method [16] is also considered. The main
disadvantage of RiDE can be attributed to the fact that individual computing nodes are supposed to be
implemented as separate programs. Such an approach can affect performance, as it requires the use of
interprocess communication tools when data is being transferring between computing nodes.
-----
вообще мысль что вот мерж картинок. я запрогал как пирамидальный. а хорошо бы чтобы система - сама как-то это ре-прогала на более оптимальный вариант.
ну т.е. я говорю вот зависимости попарные. а она - нет, у тебя их нет, вот я щас в очередь преобразую. но это автоматические оптимизации и эквивалентные преобразования 
- долгий путь, советские математики проходили... (видео Захарченко о Римме Ивановне Подловченко)

нужна какая-то очевидная техника.. чтобы оно проще было.. ну может и правда очередь асинхронную предложить аля https://www.youtube.com/watch?v=yOIEx1sJxek 47 минута.. (как асинх генератор в Жс?)
*****
И такая идея. Вот бы мне граф зависимостей и происходящего выражать в какой-то открытой структуре. Чтобы приделывать к нему оптимизаторы.
Оптимизатор мб сможет избежать такой ситуации. Вот у нас есть зависимость по аргументу от такой-то задачи. Эта задача пока сидит в промисе-сервисе. Та задача решится - она пошлет сигнал (кстати куда?) и об этом узнает промиса-сервис. Он пошлет сигнал раннер-менеджеру, тот будет шедулить задачу. Это все задержки конкретные. Нельзя ли сразу зашедулить эту задачу на вот раннер который решает первую задачу? И как-то там локальную очередь для ожидающих задач подкрутить.
Чтобы стыковать это например с возможностью SYCL работать с зависимостями. Тогда ускоритель ваще сам как бы это все подхватит а нам останется только лишь наслаждаться наблюдая скорость.

*****
****
И такая идея. Вот бы мне граф зависимостей и происходящего выражать в какой-то открытой структуре. Чтобы приделывать к нему оптимизаторы.
Оптимизатор мб сможет избежать такой ситуации. Вот у нас есть зависимость по аргументу от такой-то задачи. Эта задача пока сидит в промисе-сервисе. Та задача решится - она пошлет сигнал (кстати куда?) и об этом узнает промиса-сервис. Он пошлет сигнал раннер-менеджеру, тот будет шедулить задачу. Это все задержки конкретные. Нельзя ли сразу зашедулить эту задачу на вот раннер который решает первую задачу? И как-то там локальную очередь для ожидающих задач подкрутить.
Чтобы стыковать это например с возможностью SYCL работать с зависимостями. Тогда ускоритель ваще сам как бы это все подхватит а нам останется только лишь наслаждаться наблюдая скорость.

******
Компаланг-описания. Пишем a | b | c и это формирует нам процесс формирования тасков.
Узел получает на вход структуру S и выдает R соответствующую ей.
У a есть состояние, да. Но он обещает работать по тактам.
Ну то есть некая логика синхронизаии в него явная заложена (не обязательно соответсвующая идее что что-то поменялось щас я аутупут перещетаю.)

******
А ксатти о фильтрах. Хорошо бы чтобы я добавлял в граф какой-то фильтр а он на самом деле порождал добавку к шейдерам. (ну то есть код фильтрации в код рисования запихивал). Это значит что фильтры — не сами что-то делают, а строят. И вот этот добавит в строимое в рисующую часть — модификатор на тему а вот вам шейдер. Вот.

Это кстати согласуется с идеей оптимизатора. Если есть такая целевая структура то оптимизатор в ней это модификатор такой структуры.

Но тогда получатеся пусть эти узлы a b c формируют структуру внедряя в нее неких детей. А те уже выражают работу. А ведь могут и не детей внедрять а менять имеюущихся детей или модификаторы добавлять. Ну что-то такое.

----
https://www.nvidia.com/en-us/on-demand/session/gtcspring22-s41960/ предлагает несколько шедулеров. типа это вовсе отдельный объект. хмхмх.
(а не то что одна штучка как у нас. кстати это мб и неплохо - не говорить что мы вам найдем хорошее варианты а сказать вот вам способ управлять вариантами.

вообще вот это что-то фундаментальное для меня. это надо понять хорошенечко.
в духе моих попыток делать "за других."
ну то есть вводится контекст...
но как минимум мы можем у exec указывтаь целевой хост менеджера. а промиса-сервис то отдельный (будет)..
+++
но вообще то что я сейчас думаю в компаланге a | b | c это не про промисы и таски а вот про процесс их создания. Но это может быть и нормально так-то.
А тут про именно exec-и и их стыковку.  Но — посмотрим до синтаксиса еще не первый приоритет. Может и так и так сделаем.

************************
F-PUSH-TWO
не помню писал нет - разделить операцию пуш на 2. аллоцировать место под блок и положить блок.
тогда результаты вычислений будут быстрее. - ибо для результата надо урли а мы их быстро получим.

***********************
задолбало заходить на суперкомпь и там запускать 5 окон. я хочу - запускаться с клиентской машины и все.
запустил скрипт - оно прокинуло ssh-туннели какие надо, запустило там сервисы какие надо, и работает.
ну для общения придется видимо мостик протянуть, чтобы можно было по query проталкивать данные в клиента - ну протянуть.
(ибо мы же не в сети..). это пожалуй сейчас самое важное..
но конечно еще вопрос а надо же поле вычислительное..  а пусть программа указывает сама сколько каких узлов надо и там слурмом они сразу захватываются.
типа таких вот узлов с такими характеристиками сколько дадут (пока дают). и можно и лимит - не более 5.

ну т.е. получается. - в клиентскую либу добавить функцию запуска системы.. и эта функция:
- может подключиться к имеющемуся
- может запустить локальное и подключиться к нему
- может запустить на указанном облаке / суперкомпьютере. ну.
те.. по сути та же PPK.connect это она и есть. Ток там урль в форме: umt-spawn:u1321@umt.imm.uran.ru/system/path?slurm-job-param="--gpus a100"&limit=10"
вот и этот урль можно и внешне подавать. ну.

это было бы офигеть знатно. ну. и я думаю это даже важнее всего. ну реально мне неприятно тупить чето-там куда-то заходить чето-запускать.
а условному пользователю и подавно.

ну и если что - можно же алгоритмы туда субмитить управляющие. типа connect / submit( () => .... )
---
DONE теперь как это реализовать. ну делаем фасад и он смотрит если его то запускает что надо, получает ws-сокет для связи, и вызывает старый коннект.
ну и мостики прокинуть правильные. 

****************************
цену нидам может назначать сама нида. т.е. не единица у ниды коэффициент - а назначается нидой. это гибкость.
****************************
плюс - коэффициенты для solver-а назначений - можно указывтаь на уровне задачи решаемой.
и тогда можно гибко управлять назначением.
а то - вот задача Юра параллельная и там раннеры на решение задач не назначаются ибо типа развертывать ниду (питонский код) это мол дорого.

*********************
короче надо еще - каждый объект кода отдельно передавать. а то иначе например в графах они тупо дублируются.

***********************
отказаться от выгрузки результатов решения задачи в отдельный пуша-процесс. т.е. держать результат при себе. ну отдать по запросу.

********
по сети мысли. у нас много отправляемых висит сообщений = по 1000.. то ли их не принимают то ли не отправляют, короче заняты процессы. и вроде как параллелизация не особо это даст плюса - ну будут они быстрее приходить а там тормозить обработка.
- мб причина это медленная работа с http - ну тогда да, потоки помогут. в этом смысле тогда ноды - создают воркеров себе и с ними общаются на отправку и на прием..
- UCX хорош но в ноде нет. тогда отказываться от ноды..
- попробовать TCP и отправлять по нему json-ы. Это может оказаться быстрее тк.. нет http-обработки.
мысли
- попробовать http сервер отправку json какая быстрая. и tcp
- затем попробовать нашу прикладную функцию, в духе resolve-promise как быстро отрабатывает на том транспорте и на этом.

**********************
в Питоне уже есть create-task и await-ы всякие.
с учетом нашей идеи итераций - им только добавить распределенные Future
и будет счатье по идее. Ну и каналы не помешают удобные (у нас в принципе то нормальные). А этот распределнные Future можно построить ну вот на идее
пространства обещаний и тому подобное. Ну и можно что-то современное для каналов сообщений прикрутить. Ну или вот наше.

Заманчивая идея!

**********************
а в дополнение вот идея распределеннных списков. ну точнее они не распределенные а общие. и собираются что одни пишут другие читают.

может быть полезное в общем случае - надо подумать. но у нас довольно эффективное решение.
но впрочем это похоже на монго апдейтес. впрочем ничто не ново под луной - вопрос лишь удобства и эффективности сейчас.

====================

статистику по раннерам бы от менеджера получать. сколько кто задач сделал например.

ну и от него же можно было бы и список раннеров получать - но я поленился сделал через общие списки.

а так этот список бы мог сообщать и статистику )))ъъ

*************************
раз уж мы сделали запуск задач на конкретном раннере то напрашивается
запуск задачи на множестве воркеров ))))
т.е. если runner_id это массив то запустить на каждом из них.

и напрашивается сигнатура msg: label, args
кстати в питоне такое возможно даже без переделки сигнатуры

****************************
сделать явные wait_all / wait. т.е не exec(...,promisa1, promisa2)
а exec( ..., wait_all( promisa1, promisa2 ))
мотивация - уберется слой ожидания промис а все будет выражено на нидах..

но конечно не очень красиво получится ожидать вещи типа графов задач.. но посмотрим.

причем это можно сделать же в доп к текущему - просто вводятся операции вызова нид.

но в целом это был адаптер. просто где его внедрять. то ли в клиентах то ли в раннерах.
ну то ли вот не надо.

****************************
надо глобальным промисам дать метод then. удобно будет.

*****************************
ввести какой-то оператор преобразования данных. чтобы задачи не сами писали свои left и right значения. а оператор выкусывал их из их основных значений и результат оператора уже присылался.
это будет удобно пользоваться. потому что иначе получается расчет как бы заморачивается оформлением своих выходов. это мб и логично, но формально это ему не надо (он только потребитель).

но и аналогично можно ввести оператор впечатывания граничных значений. тогда удобно будет.
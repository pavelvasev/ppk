/*
   версия 4

   метод "Нагружаем раннеры очередью задач"
   Выяснено что при ортогональном проходе встречается ситуация "свободная касса"
   когда есть задача но раннеры с развернутыми нидсами все заняты и приходит
   свободный раннер и назначается ему. в итоге все вычисление простаивает 
   в ожидании когда же этот свободный все сделает.

   гипотеза - ввести для каждого раннера очередь задач. это позволит:
   + раннерам не простаивать а сразу брать задачу из локальной очереди
   + проталкивать задачу раннерам с нидсами, а не гадать и не ждать.
   минусы и опасения:
   - небыстрая реакция на новые раннеры. т.е. их добавление в вычислительное
   поле не сразу приведет к их загрузке - текущие задачи уже назначены.
   хотя тут можно особый случай ввести и перебалансировку будет.
   - возможно придется более тонко работать с нидсами т.к. назначаем задачу
   с учетом нидсов а их раннер вычищает.
   мб при добавлении задачи в очередь - сразу делать touch.
   в худшем случае перенести алгоритм работы с нидсами на менеджера
   (вычислять кого когда чистить).

   альтернативный вариант - просто помнить о занятых раннерах и придержать 
   задачу сколько то тактов. но помня что 50-100мс тратится на ожидание задачи
   от менеджера.. - попробуем сразу.
   
   + ведем учет передачи пейлоадов

   ==== версия 5
   выяснилось что первые К раннеров получают назначения нидсов, и дальнейшие все задачи уходят к ним.
   и из 48 раннеров используются 12 например.
   можно конечно усушкой утруской это решать например поменять размер экрана.
   но идея:
   - ввести в формулу учет нидсов кол-во развернутых. чем больше тем хуже. и тогда раннеры мб 
   сбалансируются по кол-ву нидсов. хотя мб надо не кол-во а цену развертывания учитывать, 
   но хотя бы колво.

   погонял. ну оно отдает получше. но все-равно есть ситуация что один воркер держит 3 нидсы
   и не отдает задачу тому у кого 0 нидсов. потому что формула:
   1.5 за размещение на новом сервере = (payloads_to_transfer) 1 * 0.5 + (missing_cnt) 1
   1.25 за оставление на старом = (payloads_to_transfer) 0 * 0.5 + (missing_cnt) 0 + (extra_cnt) 2 * 0.5 + (runner.queue_size) 1 * 0.25
   
   а если коэф 1
   3 нидсы: 2.25 за оставление на старом = (payloads_to_transfer) 0 * 0.5 + (missing_cnt) 0 + (extra_cnt) 2 * 1 + (runner.queue_size) 1 * 0.25
   2 нидсы: 1.25 за оставление на старом = (payloads_to_transfer) 0 * 0.5 + (missing_cnt) 0 + (extra_cnt) 1 * 1 + (runner.queue_size) 1 * 0.25

   эксремальный вариант попробовать - это extra_cnt коэф на 1 поставить.
*/


import * as PPK from "ppk"

/*
 точки входа (API)
 add_request
 add_runner_info
 runner_finished
 runner_detached
 set_env
*/

export class Solver {
  requests = new Map()           // request_id -> request_body
  executing_requests = new Map() // request_id -> request_body
  //finished_requests = new Map()  // request_id -> request_result_info
  finished_requests_counter = 0
  failed_requests = new Map()    // request_id -> request_body
  request_require_resources = new Map()  // request_id -> limits

  runners = new Map()           // runner_id -> runner_info
  executing_runners = new Map() // runner_id -> request_id
  runners_attach_counter = 0

  median_runner_queue_size = 0
  feature_use_median_queue = false
  // это оказалось какой-то неудачной идеей. почему-то медленно работает.

  env = {}
  
  wait_runners = parseInt( process.env.PPK_WAIT_RUNNERS || 0) // F-WAIT-RUNNERS

  constructor(rapi,verbose) {
    this.rapi = rapi
    this.verbose = verbose
    setInterval( () => this.report_info(), 5000 )
  }

  set_env( id, value ) {
    //this.env.set( id, value )
    this.env[ id ] = value
  }

  add_request( request_id, msg ) {
      this.requests.set( request_id, msg )  
      // F-DEFINE-LIMITS + закешируем сразу
      this.request_require_resources.set( request_id, this.compute_task_limits( msg ))
      //console.log("passing to solve")
      this.solve()
  }

  add_runner_info( runner_id, msg ) {
    let deployed_needs_ids, runner_index

    let existing_runner_info = this.runners.get( runner_id )
    if (existing_runner_info) {
      deployed_needs_ids = existing_runner_info.deployed_needs_ids
      runner_index = existing_runner_info.runner_index
    }
    else {
      runner_index = this.runners_attach_counter ++
      deployed_needs_ids = new Map() // F-JS-MAP-IS-FASTER
    }

    // F-NEEDS-DIFF обработкаем инкрементальное изменение
    //console.log("chk pt 1 ",deployed_needs_ids.size,"msg.new_needs=",msg.new_needs.length)
    for (let name of msg.new_needs) {
      // console.log("setting name=",name)
      // if (deployed_needs_ids.get(name))
      // console.log("exist!!!")
      deployed_needs_ids.set( name, msg.new_needs[name] )
    }
    //console.log("chk pt 2 ",deployed_needs_ids.size)
    for (let name of msg.removed_needs)
      deployed_needs_ids.delete( name )
    //console.log("chk pt 3 ",deployed_needs_ids.size)

    msg.deployed_needs_ids = deployed_needs_ids
    msg.runner_index = runner_index

    this.runners.set( runner_id, msg )

    if (this.feature_use_median_queue) 
    {
      let s = 0
      let arr = []
      //console.log("updating this.median_runner_queue_size")
      for (let k of this.runners.values()) {
        //console.log("runner id=",k.runner_id,"queue_size=",k.queue_size)
        s += k.queue_size
        arr.push( k.queue_size)
      }

      s /= this.runners.size
      this.median_runner_queue_size = s
      console.log("updated this.median_runner_queue_size =",s,"arr=",arr)
    }

    //console.log("updated runner-info. new needs:", Object.keys(msg.deployed_needs_ids).join("\n"))
    console.log("updated runner-info. total needs:", msg.deployed_needs_ids.size,"report_counter=",msg.report_counter,"queue_size=",msg.queue_size,"updated runner_id=",runner_id)
    // console.log("new needs =",msg.new_needs, "removed needs =",msg.removed_needs)

    this.start_solve()
  }

  // вообще конечно вопрос, кто отвечает теперь за задачи ))))
  report_info() {
    console.log('failed requests:',this.failed_requests.size)
    console.log('executing requests:',this.executing_requests.size) // , [...this.executing_requests.keys()]
    console.log('pending requests:',this.requests.size)
    console.log('finished:',this.finished_requests_counter)
    
    console.log('free runners:',this.runners.size)

    if (this.feature_use_median_queue)
      console.log("median queue_size=",this.median_runner_queue_size)
  }

  // раннер закончил вычисление задачи (удачно или нет)
  runner_finished( runner_id, request_id, msg ) {
    let t = this.executing_requests.get( request_id )
    
    if (!t) {
      console.log('got runner-finished of unknown request_id (not in executing_requests)',request_id)
      throw new Error('got runner-finished of unknown request_id (not in executing_requests)')
    }
    
    this.executing_requests.delete( request_id )
    this.executing_runners.delete( runner_id ) // вот это страннно очень

    if (msg.success) {
      this.finished_requests_counter++
      //this.finished_requests.set( request_id, msg ) // а зачем мы это храним? todo
    }
    else {
      t.error_count = (t.error_count || 0) + 1
      t.error_msg = msg.error_msg

      // F-FAILEDRUNNER - лесом слать раннеров которые сломали задачу..
      let runner = this.runners.get( runner_id )
      if (!runner) {
        console.log("runner_finished: error! runner not found in this.runners!",this.runners)
      }
      else runner.has_failed_task = t

      if (t.error_count < 10) {
        this.add_request( request_id, t ) // повторяем задачу

        this.rapi.msg( {label:'task-failed',id:t.id, task: t})
        //this.rapi.msg( {label:'task-failed',id:t.id, terror_count: t.error_count, error_msg: t.error_msg})
      }
      else {
        console.log("failed_request: this request have LOT of errors. Stopping it resubmission.",t)
        this.failed_requests.set( request_id, t )

        this.rapi.msg( {label:'task-failed-forever',task:t})
        // это мы посылаем получается промиса-сервису.
        // идея - посылать вообще всю t - для диагностики..
      }


    }
  }

  // раннер отвалился
  runner_detached( runner_id ) {
    console.log("runner_detached",runner_id, this.runners.get( runner_id))
    
    this.runners.delete( runner_id )
    let assigned_request_id = this.executing_runners.get( runner_id )
    if (assigned_request_id)
        this.runner_finished( runner_id, assigned_request_id, {success:false, error_msg:"runner detached"})
  }



  // расчет ресурсов требуемых задаче F-DEFINE-LIMITS
  limits_fn_cache = {}
  compute_task_limits( request ) {
    //console.log("==== compute_task_limits",request)
    let needs_limits = Object.values(request.arg).filter( x => x?.need ).map( x => this.compute_task_limits(x) )
    // мы учитываем сначала limits из задачи (пользователь определил) а если не определил - обращаемся к данным из оператора
    let own_operation_limit = request.limits
    if (!own_operation_limit) {

      own_operation_limit = this.limits_fn_cache[ request.code ] || this.env["limits:"+request.code] || {}
      if (typeof(own_operation_limit) == "string") {
          own_operation_limit = eval( own_operation_limit )
          this.limits_fn_cache[ request.code ] = own_operation_limit
      }
      if (own_operation_limit.bind)
          own_operation_limit = own_operation_limit( request.arg )
    }
    //console.log({own_operation_limit,needs_limits})
    // теперь надо сложить эти наши кортежи
    // проведем это прямо в own_operation_limit
    for (let nl of needs_limits) {
      for (let limit_name in nl) {
        let limit_value = nl[ limit_name ]
        own_operation_limit[ limit_name ] = (own_operation_limit[ limit_name ] || 0) + limit_value
      }
    }
    return own_operation_limit
  }

   // по задаче возвращает идентификаторы ее нидсов в форме словаря
   get_request_needs_ids( t ) {
      let acc = []
      for (let name in t.arg) {
        let val = t.arg[name]
        if (val?.simple)
          continue

        if (val?.need) {
           // вообще не учитываем F-SIMPLE
            acc.push( val.id )
          // но таки надо учесть теперь аргументы ниды. она тоже может тянуть промисы и ниды..
          // и даже у simple-нид надо учесть аргументы. пример: reuse. сам по себе он simple
          // но его аргумент - важен... хотя почему он важен непонятно. он вроде как не важен?
          // а нет не так. он там важен но только если мы собрались делать действительно reuse
          // а если обойдемся alloc-ом то и не важно... ехх..
          // но с другой стороны.. даже если это было важно, то сохранять его не нужно
          // а вот аргументы важны..
          acc = acc.concat( this.get_request_needs_ids(val) )
        }
        else if (val?.p_promise) {
          //if (!val?.simple)
            acc.push( val.id ) // промиса учитывается при назначении.
          // сразу вопрос: если промиса копеечная. то она получается имеет такой же вес
          // как и не копеечна
        }
      }
      return acc
    }


  ////// вот все что выше это базовое. можно утащить в базовый класс
  // а солвера часть собственно дальше. todo

  // лог по теме расчетов
  log_fr(...args) {
    //console.log(...args)
  }

  // find best runner for 1 task
  // т.е. делаем "ортогональную" проверку (аля смена строка-столбец в Венгерском алгоритме)
  find_runner_for_task( t,runners,request_needs  ) {
    this.log_fr("find_runner_for_task task_id=",t.id)
    //console.log( t )
    let best_r = null, best_est = 10000000
    //let request_needs = this.get_request_needs_ids( t )
    for (let runner of runners) {
      /*
      if (runner.has_failed_task) { // F-FAILEDRUNNER
        console.log("@@@@@@@@@@@@@ this runner had failed in past, skipping", runner.runner_id )
        continue
      }
      */
      // проверим хватает ли ресурсов раннера для выполнения этой задачи
      let task_limits = this.request_require_resources.get( t.id )
      let limits_ok = true
      for (let limit_name in task_limits) {
        if (!runner.limits[limit_name] || runner.limits[limit_name] < task_limits[limit_name]) {
          console.log("!!!! task is not suitable for this runner, not enought limit_name=",limit_name)
          console.log("runner limits=",runner.limits,"task_limits=",task_limits )
          limits_ok = false
        }
      }
      if (!limits_ok) continue
      
      let est = this.estimate( t, request_needs, runner )
      //console.log( 'runner',runner.runner_id,'est',est, 'have needs:', this.verbose ? Object.keys(runner.deployed_needs_ids) : Object.keys(runner.deployed_needs_ids).length ) 
      if (est < best_est) {
        best_r = runner
        best_est = est
      }
      if (est <= 0) break  // лучше уже не будет
    }
    this.log_fr('found best runner for this task of est=',best_est,"runner_id=",best_r?.runner_id)
    return {best_r,best_est}
  }  

  // функция вычисления стоимости развертывания нидсов request_needs на раннере runner
  // todo а как мы учтем стоимость копирования данных? это тоже надо как-то учитывать.
  estimate( task, request_needs,runner ) {
      this.log_fr('======== runner_id',runner.runner_id )
      let runner_needs = runner.deployed_needs_ids;
      let missing_cnt = 0 // кол-во неразвернутых нидсов которые придется развернуть на этом раннере для этой задачи
      //let simple_missing_cnt = 0
      
      // те что предстоит развернуть
      for (let id of request_needs) {
        if (!runner_needs.has( id ))
        {
            if (id.startsWith("ppk.python_")) continue; // hack yura-11
            missing_cnt++
            this.log_fr( "missing_need:",id)
        }
      }

      // лишние нидсы на этом раннере для этой задачи
      let extra_cnt = 0
      // короче выяснилось что это криминал... их там слишком много.. и менеджер жестоко тормозит
      // сообразно надо или скоростное сравнение
      // или отказаться от этой части логики
      // или еще что-то думать. todo.

      /*for (let id in runner_needs) {
        if (!request_needs[ id ]) extra_cnt++
      }
      */
      

      // о! супер-формула!
      // request_needs.length - missing_cnt = это есть ниды, нужные и уже развернутые на раннере      
      //console.log("Object.keys(runner_needs).length=",Object.keys(runner_needs).length)
      //console.log("request_needs.length=",request_needs.length)
      extra_cnt = runner_needs.size - (request_needs.length - missing_cnt)

      // кол-во пейлоадов которые надо будет качать для задачи и для нидсов неразвернутых

      // F-CONSIDER-PAYLOAD-LOCATION
      //let payloads_to_transfer = count_payloads_to_transfer( task.arg )
      //console.log({payloads_to_transfer,missing_cnt,extra_cnt},'runner.queue_size=',runner.queue_size,'runner.local_pusha_url=',runner.local_pusha_url)
      let extra_coef = 1 // было 0.5 но и 1 вроде неплохо
      // но если там все что надо есть, то и хорошо же - экстра-ниды не страшны..
      if (missing_cnt == 0) extra_coef = 0
        
        extra_coef = 0

      let queue_coef = 0.1; // 0.25 было на кубике 
      //let queue_coef = 0; // для задачи Юры

      let queue_size = (runner.queue_size || 0)
      //let q_size = queue_size * queue_coef
      
      //let est = 0.5 * payloads_to_transfer + missing_cnt + extra_coef * extra_cnt + queue_coef * (runner.queue_size || 0)
      //let simple_coef = 0.0
      // ну!. вот просто скока надо передавать да и все. это кол-во передач получается.
      //console.log(est)
      //console.log(`${est} = (payloads_to_transfer) ${payloads_to_transfer} * 0.5 + (missing_cnt) ${missing_cnt} + (extra_cnt) ${extra_cnt} * ${extra_coef} + (runner.queue_size) ${(runner.queue_size || 0)} * ${queue_coef}`)

      /* yura-10      
      let est = missing_cnt + queue_size * queue_coef // передать пейлоаду. развернуть трудную ниду.
      this.log_fr(`${est} = (missing_cnt) * ${missing_cnt} + (queue_size) ${queue_size} * ${queue_coef}`)
      */

      // yura-11
      let est = missing_cnt + Math.log(queue_size+1) * queue_coef
      // * queue_coef // передать пейлоаду. развернуть трудную ниду.
      this.log_fr(`${est} = (missing_cnt) * ${missing_cnt} + Math.log( 1+(queue_size) ${queue_size})`)

      return est
      
      // F-CONSIDER-PAYLOAD-LOCATION
      // не испльзуется
      function count_payloads_to_transfer( args={} ) {
        let cnt = 0
        for (let aname in args) {
          let arg = args[aname]
          if (!arg) continue
          //console.log('===== checking arg name',aname,'.payload_info=',arg.payload_info)
          if (arg.payload_info) {
            console.log('---- found payloads in arg name',aname)
            for (let pi of arg.payload_info) {
              if (!pi.url.startsWith( runner.local_pusha_url )) {
                cnt ++
                console.log("payload mismatch, need transfer",pi.url )
              }
              else {
                console.log("payload match, no transfer",pi.url )
              }
            }
          }
          else if (arg.need && !runner_needs.has( PPK.compute_need_id(arg,true,task.local_env) )) {
            console.log("==== detected non-expanded need, considering it's payloads", aname)            
            cnt += count_payloads_to_transfer( arg.arg )
          }
        }
        return cnt
      }
    }

  // попытка отложенного solve, а то не успеваем runner-info обрабатывать
  start_solve() {
    if (this.solve_pending) return
    this.solve_pending = true
    setImmediate( () => this.solve() )
  }

  solve() {
    this.solve_pending = false

    if (this.requests.size == 0) return
    if (this.runners.size == 0) return

    // итак много задач.. как они там будут работать.. надо посмотреть...
    // ну причем мы на паузу ставим всех.. хотя еще вариант - пропускать нулевых...  
    if (this.feature_use_median_queue && this.median_runner_queue_size > 500) {
      console.log("skipping, big this.median_runner_queue_size = ",this.median_runner_queue_size)
      return
    }

    this.log_fr("~~~~~~~~~~~~~~~~~~~~~~~~~~~ solving requests=",this.requests.size,"runners=",this.runners.size)

    if (this.wait_runners > 0 && this.runners.size < this.wait_runners) {
      console.log("solver: solve, F-WAIT-RUNNERS -- not enought runners")
      return
    }
    this.wait_runners = 0 // если мы получили сколько надо воркеров, переходим в фазу нагружения
    
    //console.time("solve")
    let runner_iter = null
    let reset_runner_iter = () => {
        runner_iter = this.runners.values()
    }
    reset_runner_iter()

    let tasks_iter = this.requests.values()

    while (true) 
    {
      let t = tasks_iter.next().value;
      if (!t) break

      let task_needs = this.get_request_needs_ids( t )
      //let task_needs = this.get_request_needs( t )
      let f3 = this.find_runner_for_task(t, this.runners.values(), task_needs )
      let s = f3.best_r

      // типо в этом методе - задачи таки надо назначать куды-то все

      if (!s) {
        if (this.runners_attach_counter > 0) // печатаем только если приходили раннеры. ибо может просто пока не пришли.
            console.log("!!!! cannot find runner for task",t.id,"f3=",f3)
        // console.warn было. но вроде я теперь считаю что это рядовая ситуация, 
        // мол пока раннер может и не подключился просто, чего население пугать то
        continue
      }
      
      let task = {...t, label:s.task_label, env: this.env }

      //console.log("solve: task=",task)
      
      // todo вообще это не дело солвера, запускать таски. его дело - сообщить какое что куда.

      this.rapi.msg( task )
      
      this.rapi.msg( {label:"task-assigned",task,runner_index:s.runner_index} ) // F-VISUAL-DEBUG
      
      this.requests.delete( t.id )
      this.request_require_resources.delete( t.id )
      this.executing_requests.set( t.id, t )
      this.executing_runners.set( s.runner_id, t.id )

      // ща надо попатчить раннер.. нидсы и размер очереди
      // эти данные потом обновяться от runner-info

      // короче это какой-то криминал оказался.. по кр мере task_needs надо не так добавлять.
      // let task_needs = this.get_request_needs_ids( t )            
      // s.deployed_needs_ids = { ...task_needs, ...s.deployed_needs_ids}
      // ускоренная версия. ну смысл этого всего - чтобы мы учитывали что на этом раннере вот
      // это якобы есть (Ну будет же)
      for (let id of task_needs)
        s.deployed_needs_ids.set( id, true )

      // главную задачу тоже будем считать что она задеплоится в форме ниды (ее результат)
      s.deployed_needs_ids.set( t.id, true )

      // кстати тут есть такой нюанс. изменения потом патчами придут. и вот эти вещи - не факт что придут
      // это мы просто на доверии работаем, на ожидании что так все и будет.
      // возможно это стоит отметить как-то по-особенному..
      
      // ну типа это локальная добавка - до следующей посылки
      s.queue_size = (s.queue_size || 0) + 1


      if (this.verbose)
        console.log("submitted task",task,'to runner', s )
    }
    //console.timeEnd("solve")
  }    
}


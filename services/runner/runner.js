#!/usr/bin/env -S node --expose-gc --trace-warnings
// --inspect 

// tood раннер должен выбирать такую задачу чтобы заюзать побольше нидсов своих
// F-RUNNER-VERBOSE - режим вывода информации побольше и поменьше.
//                    сделано путем создания метода console.verbose

import * as PPK from "ppk"
import * as CHILDPROCESS from "node:child_process";

import { dirname } from 'path';
import { fileURLToPath } from 'url';

//configure( dirname(fileURLToPath(import.meta.url)) )
let __dirname = dirname( fileURLToPath( import.meta.url ) ) 

let RUNNER_ID = process.env.RUNNER_ID || "runner"
PPK.prefix_console_log( () => [`[${RUNNER_ID}]`,performance.now()] )
PPK.mk_console_verbose( process.env.VERBOSE )

let counter=0;
let global_queue_size = 0
let main_tasks_solving = 0

// ExecEnv? да не пусть языковое будет, языковая среда - ну мол так понятнее
// хотя точнее конечно среда исполнения или платформа исполнения.. условное .net всякое - там много языков
// в общем пока не важно
class LanguageEnv {
  constructor( rapi ) {
    this.rapi = rapi
  }

  cleanup() {}

/*
  выполнить действие action_id с аргументами 
  и записать результат действия в окружение в ячейку id (это будет нида)

  аргументы:
  id - идентификатор в окружении в которую положить результат
  action_id - код действия который следует выполнить
  const_args - константы, словарь вида { argname: argvalue }
  needs_args - идентификаторы в окружении, словарь вида { argname: id }

  результат:
  обещание, которое резолвится в значение - результат выполнения операции.
  это значение должно быть "обезжиренное" - все пейлоады выгружены.
  + также к нему должен быть прикреплен метод clear() - очистка ниды.
  + также к нему должно быть прикреплено поле resources - информация об используемых ресурсах.

  считается что ЯС выполнит задачу и положит результат в развернутом виде себе в память.
  раннер отслеживает память и очищает по мере необходимости
  
  // todo может сделать add_tasks - пакетом. ну типа оптимизация передачи.
  // maybe needs_args - это таки таски нидов? тогда пакет не надо. и вообще action_id не надо))
  // но тогда это более высокий уровень абстракции
  // возвращает.. промису? а зачем? знать когда сделалось?
  // ну еще может результат деструктурированный возвращать, чтобы например мы отправили runner-finished
*/  
  add_task( id, action_id, const_args, needs_args, is_main_queue ) 
  {
    this.init_if_not_inited()
  }
  
}

/*
class TimeStats {
  value = 0
  constructor() {}
  append( a ) { this.value += a }
}
*/

import { hrtime } from 'node:process';

class JsEnv extends LanguageEnv {

  constructor( rapi ) {
    super(rapi)

    this.env = {}

    // готовим нидсу с кодом
    this.env['compile-js'] = (args) => {
      //console.log('thus called js.',arg )
      let f = null
      try {
        f = eval( args.text )
      } catch (err) {
        console.error("JsEnv: error in js need:",args.text)
        throw err
      }
      return f
    }

    // вычислить
    // итого вещи типа rapi.js должны вызывать compute..
    this.env['compute'] = (args) => {
      let f = args.func
      let result = f( args )
      return result
    }

    // загрузить пейлоаду
    this.env['get-payload'] = (args) => {
      let info = args.payload_info
      return this.rapi.get_payload( info )      
    }

    this.env['skip-payloads'] = (args) => {
      return args
    }

    // загрузить пейлоаду - в режиме восстановления объекта
    this.env['restore-object'] = (args) => {
      let info = args.payload_info
      return this.rapi.get_payload( info ).then( payloads => {
        args.payload = payloads
        if (args.single_payload) 
            return payloads[0]
        return args
      })
    }

    // F-LANG-ENV-STATS
    // будем вести учет времени которое среда потратила на то или на се
    // и печатать эту долю по отношению к астрономиескому времени
    // main это время на основные задачи.
    // need это на ниды
    // tail это на выгрузку результата
    //this.stats = {main:BigInt(0), need:BigInt(0), tail:BigInt(0), begin_at: null}
    this.stats = {main:0, need:0, tail:0, begin_at: null}

    //console.log("STARTING STATS", this.stats_time())
    // надо мерять то циклы цпу а не время.. время мы там может тормозим жеж тупо.
    // https://nodejs.org/api/os.html#oscpus
    // ну и для этого видимо надо - абстрагировать как-то операции.
    setInterval( () => {
      let tall = this.stats_time() - this.stats.begin_at
      let sum = this.stats.main + this.stats.need + this.stats.tail
      console.log(`>>>>>>>>>>>>>> stats report: main=${this.stats.main / tall} need=${this.stats.need / tall} tail=${this.stats.tail / tall} sum=${sum / tall} outer_and_subtasks=${1 - sum/tall}`)
      //console.log(`>>>>>>>>>>>>>> stats report: ${this.stats.main} ${tall} main=${this.stats.main / tall} need=${this.stats.need / tall} tail=${this.stats.tail / tall} sum=${sum / tall} outer_and_subtasks=${BigInt(1) - sum/tall}`)
      }, 1000)

    // todo: rapi.begin_listen_list( "js:env" )
    // это для дефинов?

    // размещаем исполнение тасков - в очереди задач ноды
    // чтобы стало быть они там распределялись.. и main-task не блокировала нам прием новых задач
    
    let add_task_orig = this.add_task.bind(this)
    this.add_task = (...args) => {
      return new Promise( (r,j) => {
         setImmediate( () => {
           add_task_orig( ...args ).then( res => r(res)).catch( err => j(err))    
         }) 
      })
    } 
  }

  stats_time() {
    //return hrtime.bigint()
    return performance.now()
  }

  // пока получается что таска возвращает промису и когда таска выполнится = промиса выполнится
  // но в целом - можно вовсе возвращать просто свою промису.. а не вот эту вот..
  add_task( id, action_id, const_args, needs_args, is_main_queue ) 
  {
     let my_promise = this.create_need_promise( id )

     console.verbose("js-env: add_task got control",{id,action_id,const_args,needs_args})
     return this.give_me_func( action_id ).then( action_func => {

       let keys = Object.keys( needs_args )
       let needs_promises = keys.map( key => this.get_need_promise( needs_args[key] ))
       console.verbose("action_func achieved. entering waiting needs:",{id,action_id,needs_promises})
       return Promise.all( needs_promises ).then( needs_values => {
          //console.log("needs complete, calling action_func:",{id,action_id})
          let args = {...const_args}
          needs_promises.forEach( (p,index) => args[ keys[index] ] = needs_values[index])
          //console.time(`action_func computed id=${id} action_id=${action_id}`)
          let tt0 = this.stats_time() // F-LANG-ENV-STATS
          if (this.stats.begin_at == null) {
             this.stats.begin_at = tt0
             //console.log("stats begin at",tt0)
          }   
          console.log("calling action_func. is_main_queue=",is_main_queue,"id=",id)
          let res = action_func( args )
          //console.timeEnd(`action_func computed id=${id} action_id=${action_id}`)
            let tt1 = this.stats_time()
            let tt = tt1 - tt0
            //console.log({tt})
            if (is_main_queue) this.stats.main += tt; else this.stats.need += tt;

          console.verbose("action_func returned control:",{id,action_id,res})
          return Promise.resolve( res ).then( value => {
            let tt2 = this.stats_time()
            console.verbose("result resolved. saving and resolving:",{id,action_id,value})
            // сохраняем результат

            // update вообще это странновато.. но видимо это оконцовка всех тасков такова.
            // потому что это так-то завершающая подзадача (антинида)

            // ответственность языковой среды 
            // 1 - оставить нетронутый результат в форме ниды в оперативной памяти ЯС
            // 2 - обезжирить результат. (выгрузить его в пушу если надо)
            // 3 - вернуть обезжиренный результат раннеру.. хотя странно - он бы мог взять его из промисы ниды
            //     а нет, он не мог бы взять его из ниды. потому что в ниде сидит именно что необезжиренный
            // 4 - причем снабдить обезжиренный результат еще и функцией очистки (удаления ниды)
            // 5 - если задача основная - разрезолвить промису задачи обезжиренным результатом
            // M42: updatE: результат 2-5 вообще говоря нужен только если это основная задача
            // а если это подготовка ниды.. то эти шаги делать не надо
            // update-2: но вроде как очистка ниды нужна и для собственно нидов.. так что пнукт 4 оставляем..
            // 5 - и еще среда ДОЛЖНА сообщить информацию об используемых ресурсах. Не раннеру же об этом догадываться.

            // todo реструктурированный неправильно. правильно обезжиренный или вроде того.

            // пункт 4
            if (value) {
              value.cleanup = () => {
                this.clear_need( id )
                // ну в нашем случае пейлоады - сами освободятся, т.к. ссылка теряется
              }
              value.resources = this.compute_value_resources( value )
            }

            // пункт 1
            //console.log("JS_ENV INTERNAL NEED RESOLVED",id) // xxx
            this.get_need_promise( id ).resolve( value )

            if (!is_main_queue) {
              this.stats.tail += this.stats_time() -tt2
              return value // M42
            }

            global_queue_size-- // F-SHORTER-QUEUE
            console.log("global_queue_size DEC",id)

            // вообще говоря тут надо не value возвращать, а именно что resources и cleanup

            // пункт 2
            let result_payload_p  // F-UNFAT-OBJECT
            if (value?.payload) {
              console.verbose("payload!")
              // это у нас 2 вида протокола на возврат значений. просто значение и словарь { result: ..., payload: ...}
              // это было раньше. а теперь я придумал что возвращается просто что-то
              // но если в этом что-то есть .payload то оно преобразуется в .payload_info..

              // надо скопировать самое себя - потому что мы обезжириваем теперь
              // а объект value запомнился выше в ниде
              value = {...value}

              console.time("jsenv: upload_result_payloads")
              result_payload_p = this.rapi.submit_payload_inmem( value.payload ).then( (payload_info_array) => {
                  console.timeEnd("jsenv: upload_result_payloads")
                  value.payload_info = payload_info_array
                  delete value['payload']
              })
            } else 
            if (value.buffer) { // была идея - привести к .payload и далее работать единообразно. ну метко поставить - для распаковки
              console.verbose("buffer!")
              console.time("jsenv: upload_result_payloads (single)")
              result_payload_p = this.rapi.submit_payload_inmem( value ).then( (payload_info) => {
                  console.timeEnd("jsenv: upload_result_payloads (single)")
                  //let c1 = value.
                  value = {single_payload:true, payload_info: [payload_info], cleanup: value.cleanup, resources: value.resources}
              })
            } else
               result_payload_p = Promise.resolve()

            let tail_time = this.stats_time() - tt2
            //console.log({tail_time})
            this.stats.tail += tail_time

            return result_payload_p.then( () => {
              // пункт 3
              //console.log('RESOLVING PROMISE',id,value )
              //this.rapi.resolve_promise( {id}, value ) // мы типа воссоздаем объект промисы. странно.

              return value
            })

            
          }).catch( err => {
            this.get_need_promise( id ).reject( err )
            // важно прокинуть ошибку дальше. а то получится что add-task ток хорошее возвращает
            return Promise.reject(err)
          })
       })

     })
  }

  // все дальше это внутреннее

  // готовит структуру о ресурсах (оперативной памяти) затрачиваемые средой на хранение ниды
  compute_value_resources( value ) {
    if (value.resources && Object.keys(value.resources).length > 0) 
        return value.resources

    if (value.buffer) {
      //console.log("!!!!! value.buffer.length=",value.buffer.byteLength)
      return {ram: value.buffer.byteLength}
    }
    if (value.payload) {
      let sum = 0
      value.payload.forEach( arr => sum = sum + arr.buffer.byteLength )
      //console.log("!!!!! sum=",sum)
      return {ram: sum }
    }
    return {ram:1024} // значение по умолчанию.. для пока-не-рассчитанных данных?
  }

  give_me_func( action_id ) {
     // т.е. мы считаем что все action_id должны были быть положены в env
     // но зачем-то я решил что это должно быть именно промисой.. типа функция может и позже появиться..
     // странно все это.. как функция то позже появится?
     // или это ну просто что если другие кладут в env значение, внешним define, то
     // в env мы их содержим все в форме промис
     // и лишь это обуславливает почему мы возвращаем промису здесь - единообразие доступа.
     let action_func_p = this.get_need_promise( action_id, true )
     return Promise.resolve( action_func_p )
  }

  //////////// работа с таблицей нидсов

  // возвращает промису для таблицы
  // сделано must_exist по умолчанию true чтобы не зависать а контролировать, что
  // все на что мы опираемся - определено
  /*
  get_need_promise(key, must_exist=true) {
    let t = this.env[key]
    if (t) return t

    if (must_exist) throw new Error(`js-env: need not found. key=${key}`)

    let a1,a2
    t = new Promise( (resolve,reject) => {
      a1 = resolve
      a2 = reject
    })
    t.resolve = a1
    t.reject = a2
    t.id = key
    this.env[key] = t
    return t
  }
  */

  get_need_promise(key, must_exist=true) {
    let t = this.env[key]
    if (t) return t

    throw new Error(`js-env: get_need_promise: need promise not found. key=${key}`)
  }

  create_need_promise(key, must_exist=true) {
    let t = this.env[key]
    if (t) 
      throw new Error(`js-env: create_need_promise: need promise already exist. key=${key}`)

    let a1,a2
    t = new Promise( (resolve,reject) => {
      a1 = resolve
      a2 = reject
    })
    t.resolve = a1
    t.reject = a2
    t.id = key
    this.env[key] = t
    return t
  } 

  clear_need( id ) {
    if (this.env[ id ])
      delete this.env[ id ]
  }

/* ну вроде как это не надо и не вызывается вовсе даже
  // очистить ниды по списку id_list
  clear_needs( id_list ) 
  {
      for (x of id_list) {
        this.get_need_promise( x ).then( v => {
          if (v.cleanup) v.cleanup()
            delete this.env[ v ]
        })
      }
  }
*/  

}

class SubprocessEnv extends LanguageEnv {

    constructor( rapi, on_clear_need ) {
      super(rapi)
      this.on_clear_need = on_clear_need // F-REUSE-PAYLOADS
    }

    add_task( id, action_id, const_args,needs_args, is_main_queue=false ) {

      let s_env = this.get_s_env()
      //console.log("s_env=",s_env)
      return s_env.then( (his_task_queue) => {
          return new Promise( (f_resolve,f_reject) => {
              // ну todo это, странное оно все. у нас много же запросов одновременно
              this.exit_cb = f_reject

              delete const_args['had_coneeds'] // todo выяснить что это у меня вообще за такое 

              this.rapi.request( { "label":his_task_queue, cmd:"add_task", 
                  id, action_id, const_args, needs_args,is_main_queue } ).done( result => {
                // console.log("python_function done, result=",result)
                // если там по дороге возникнут ошибки программы - отмена работы фукнции сей
                this.exit_cb = () => {}

                if (is_main_queue) {
                  global_queue_size-- // F-SHORTER-QUEUE
                  console.log("global_queue_size DEC",id)                
                }

                if (result.success) {
                    let value = result.value

                    if (value instanceof Object) {
                      value.cleanup = () => {
                        console.error("subprocess value.cleanup called. id=",id)
                        this.clear_need( id )
                      }
                      // value.resources - должны там подготовить
                      // ну формально.. потому что там и gpu-ресурс может использоваться..
                    }
                    
                    f_resolve( value )
                }
                else {
                    let str = this.stderr_acc.join("\n")
                    this.stderr_acc = []
                    
                    let q = {msg: result.msg, runner_id: RUNNER_ID, pid:this.prg?.pid, stderr:str}
                    f_reject( q )
                    //f_reject( result.msg )
                  }
              })
            })
      }).catch( err => {
        console.error("SubprocessEnv: add_task error",err)
      })

      /*
      prg.stdin.cork()
      let str = JSON.stringify( args )
      prg.stdin.write( str )
      prg.stdin.uncork() // такое у них флаш
      //console.log("thus stringified args=",args)
      */
  }

  get_s_env() 
  {
    this.get_s_env = () => this.s_env
    this.init()
    return this.s_env
    // вообще лучше уж this.init возвращает пусть промису локальную.. ну ок
  }

  ///////////////////// внутреннее
// очистить ниду по списку id_list
    clear_need( id ) {
      return this.get_s_env().then( (his_task_queue) => {
          return new Promise( (f_resolve,f_reject) => {
              console.log("subprocess: sending clear-need cmd",id)
              return this.rapi.request( { "label":his_task_queue, cmd:"clear_need", id } ).done( result => {
                //console.log("python_function done, result=",result)
                // если там по дороге возникнут ошибки программы - отмена работы фукнции сей
                this.exit_cb = f_reject // ?

                if (result.success)
                    f_resolve( result.value )
                else {
                    let str = this.stderr_acc.join("\n")
                    let q = {msg: result.msg, runner_id: RUNNER_ID, pid:this.prg?.pid, stderr:str}
                    f_reject( q )
                    //f_reject( result.msg )
                  }
              })
            })
      }).catch( err => {
        console.error("SubprocessEnv: clear_need error",err)
      })
    }    

  init() {
    let prgpath = __dirname + "/ppk-python-env.py" /// todo override
    let rapi = this.rapi

    // ну тут видимо.. промиса по управлению должна быть. которая команды передает
    this.s_env = new Promise( (resolve,reject) => {
      
      //let his_task_queue = ""
      let my_guid = rapi.generate_uniq_query_id("subprocess_env")

      // в этот момент я думаю что мб Dask не так уж и не прав, создавая каналы на основе сетевых адресов
      // мол, зачем нам тут - консультации с центром (а query и т.п. через них идут, хоть и разово)
      rapi.query( my_guid ).done( msg => {
        if (msg.stage == "set_task_queue") 
        {  
          // вообще то и мы могли бы ему назначить.. но ладно
          // в целом это главное - что подпроцесс прислал нам сигнал и это значит что он готов к работе
          this.his_task_queue = msg.python_task_id
          this.prg = prg

          this.exit_cb = () => {} // до этого было reject а теперь усе

          //rapi.reply( msg, true )
          resolve( this.his_task_queue )
        }
        else if (msg.stage == "auto_clear_need") // F-REUSE-PAYLOADS
        { 
          console.error("AUTO-CLEAR-NEED MSG!",msg)
          this.on_clear_need( msg.id )
        }
        else console.log("SubprocessEnv: unknown msg",msg)
      })

      let args = [rapi.url, my_guid] // так-то идея очереди: ws://urla/channel/.....

      let prg = CHILDPROCESS.spawn( prgpath, args, {stdio: ['ignore','pipe','pipe']} )
      let prg_exited = false

      let next_cb = () => {}

      this.exit_cb = reject // () => {}

      this.cleanup = this.do_cleanup.bind(this)

      let stderr_acc = []
      this.stderr_acc = stderr_acc
      prg.stderr.on('data', (data) => {
        data = data.toString()
        console.log(`>>>>> SubprocessEnv [${prg.pid}] `,"stderr:",data)
        if (stderr_acc.length > 50) stderr_acc.shift() // не будем много копить
        stderr_acc.push( data )

        this.rapi.msg({label:"subprocess-stderr",data})

        //this.exit_cb("exitcode=stderr")
      });
      prg.on('error', (data) => {
        console.log(`>>>>> SubprocessEnv subprocess [${prg.pid}] `,"error:",data)
        this.exit_cb("exitcode=error")
      });
      prg.on('spawn', (data) => {
        console.log(`>>>>> SubprocessEnv subprocess [${prg.pid}] `,"spawned!")
      });
      prg.on('exit', (code,signal) => {
        console.log(`>>>>> SubprocessEnv subprocess [${prg.pid}] `,"exited! code=",code,signal)
        prg_exited = true // почему-то killed там не всегда выставляется

        if (code != 0 || code == null) {
          let str = stderr_acc.join("\n")
          this.exit_cb( {msg: 'SubprocessEnv subprocess error', runner_id: RUNNER_ID, exitcode:code, pid:prg.pid, stderr:str} )
          //exit_cb(`exitcode=1 pid=${prg.pid}. stderr=${str}`)
        }
          //throw "suprocess serios error!"
      });

      prg.stdout.on('data', (data) => {
        data = data.toString()
        console.log(">>>>> SubprocessEnv subprocess stdout:",data)
        //next_cb( data );
        next_cb = () => {}            
      });

    }) // promise
  }

  do_cleanup () {
      console.verbose("SubprocessEnv.cleanup called!")
      if (this.prg_exited) {
        console.log("prg_exited, doing nothing")
        return
      }
      return new Promise( (resolv,reject) => {
        // такая техника.. надо дождаться завершения.
        this.prg.on('exit',() => {
          resolv(true)
        })
        this.prg.kill() // sends SIGTERM by default
        console.log('waiting for actual python_function subprocess exit.. pid=',this.prg.pid)
      })
    } // cleanup

}


/*
process.on('unhandledRejection', (reason, promise) => {
  console.log('runner: Unhandled rejection reason:', reason, reason.stack, promise);
})
*/

let uhr_handler = () => {}
/*
process.on('unhandledRejection', (reason, promise) => {
  console.log('runner: Unhandled rejection reason:', reason);
  uhr_handler(reason); uhr_handler = () => {}
  // console.log('runner: Unhandled Rejection at:', promise, 'reason:', reason);
  // Application specific logging, throwing an error, or other logic here

  //console.log("runner: top-level logic clears all deployed needs")
  //dn.tick( {ram: 0, gpu: 0} )
  // но зачем? - а затем, что возможно нида какая-то сломалась и теперь ей нельзя использовать..
  // но это можно и в uhr_handler посадить..
  // но - мы не знаем какая нида сломалась. может быть она в работе сломалась.. когда работала другая нида
  // и использовала эту. поэтому надежно - это почистить все
  dn.forget_all_needs()

  console.log("going to restart connection")

  return restart_connection()
});
*/

import { TrackDeployedNeeds,DeployedNeeds } from "./runner-local-needs.js"

// можно переделать чтобы менялось во времени. но практика что раннеру заранее ограничиваем - удобно.
let runner_limits = { 
        ram: igetenv("RAM_LIMIT",2*1024)*1024*1024, // 2 гб
        gpu: igetenv("GPU_LIMIT",1*1024)*1024*1024  // 1 гб
      }

let dn = new TrackDeployedNeeds( new DeployedNeeds(), runner_limits )
let current_ppk = null

restart_connection()

///////////////////////////////

//let restarting=false
function restart_connection() {
  console.log('restart_connection called')
//  if (restarting) {
//   console.log('already restarting'); return
//  }
//  restarting = true
  
  try {
    //let dn = new DeployedNeeds()    
    // но вообще это странно - например у нас уже есть соединение.. нам всем присылать 2 раза будут?
    // поэтому сохраним к чему мы были подцеплены
    
    if (current_ppk) {
      console.log("FORCE exiting old ppk connection")
      current_ppk.exit()
      current_ppk = null
    }

    console.log("try connecting to mozg",process.env.MOZG_URL || '(default url)')
    PPK.connect( RUNNER_ID,{url:process.env.MOZG_URL, submit_payload_url: process.env.PUSHA_URL}, process.env.VERBOSE ).then(mozg => {
    //PPK.connect( RUNNER_ID,process.env.MOZG_URL, process.env.VERBOSE, process.env.PUSHA_URL ).then(mozg => {
    
      if (current_ppk) {
        console.log('restart_connection: current_ppk is already assigned while we was closing it...')
        process.exit(1)
      }
    
      current_ppk = mozg
      console.log("connected")
      let report_time = new ReportTime()

      process_one_job_loop( mozg, () => {
        return `fps: ${ report_time.tick() }`
      }, dn)

      mozg.ws.on('close', () => {
        console.log('ws on close: scheduling reconnection')
        setTimeout( restart_connection, 500 )
      } )
    })
    .catch( err => {
      console.log("connection err",err)
      console.log("c2: scheduling restart_connection 2000")
      setTimeout( restart_connection, 2000 )
    })
  } catch (err) {
    console.log("restart_connection exception",err)
    console.log("c3: scheduling restart_connection 2000")    
    setTimeout( restart_connection, 2000 )
  }
}

class ReportTime {
 last_report_time = performance.now()
 counter=0

 tick() {
   let t = performance.now()
   this.counter++
   if (t > this.last_report_time + 1000) {
     this.fps = this.counter / ( (t - this.last_report_time) / 1000.0 )
     this.counter = 0
     this.last_report_time = t
   }
   return this.fps
 }

}

function process_one_job_loop( rapi, report, deployed_needs_dict ) {

  let task_label = rapi.generate_uniq_query_id('task_label')

  let cnt = 0
  let queue_executor = mk_queue_fn()    
  let queue_size = 0; // кол-во задач которые поручены раннеру и еще не решены

  let at1 = 0

  let report_counter = 0
  let report_again
  let report_info = (solved_task_id,force_report) => {

    // запрещаем посылать информацию чаще чем K=1 раз в секунду

    let at2 = performance.now()
    if (!force_report && at2 - at1 < 1000) {
      // оказалось что если вот мы ушли в отказ не посылать отчет
      // то потом его и не пошлем ни разу если больше не вызывают
      // ну поэтому пока вот так.
      if (!report_again)
          report_again = setTimeout( () => report_info(solved_task_id),2000)
      return
    }
    if (report_again) clearTimeout( report_again )
    report_again = null
    at1 = at2

    // F-NEEDS-DIFF
    let [new_needs,removed_needs, all_needs] = deployed_needs_dict.extract_events()

    //console.log("reporting runner.","deployed needs",rep,"t=",t1 )
    let msg = {label:'runner-info',
               task_label,
               solved_task_id,
               runner_id: task_label,
               limits:deployed_needs_dict.resources_total,
               local_pusha_url: process.env.PUSHA_URL, // F-CONSIDER-PAYLOAD-LOCATION
               queue_size: queue_size,
               report_counter,
               new_needs, removed_needs }

    console.verbose("reporting runner.",msg )
    console.log("reporting runner. queue_size=",queue_size,"new_needs=",
      new_needs.length,"removed_needs=",removed_needs.length,"all needs=",all_needs.size,
      "report_counter=",report_counter )

    report_counter++

    //console.log("reporting runner. deployed_needs_ids=",Object.keys(deployed_needs_ids).join("\n") )
    return rapi.msg( msg ) // F_RUNNER_INFO_NEED_HINTS
               //deployed_needs_ids: deployed_needs_dict.get_keys() } )
  }
  report_info( undefined, true )

  // это забавная фишка - чистить заранее
  setInterval( () => {
    console.log("checking resources just in case")
    let extra_resources_required = {ram:100*1024*1024} // подчищаем чтобы было АТЬ мегабайт хотя бы
    deployed_needs_dict.check_resources( null, extra_resources_required )
  },100)

  let t1 = 0
  rapi.query( task_label,{value:task_label} ).done( msg => {

    preprocess_s_expr( rapi,msg,deployed_needs_dict ) // тачи тут всякие
    // хотя эти тачи некорректные - более старые задачи будут иметь более приоритетный тач...
    // хотя можно и повернуть просто порядок задач будет.. хм..
    // а можно взять время кстати из очереди из места 0 вычесть и 1 микросекунду

    let fn = () => {
      let t2 = performance.now()
      console.log("============== process_one_job begin. task_id=",msg.id,"queue_size=",queue_size,"global_queue_size=",global_queue_size,"main_tasks_solving=",main_tasks_solving)
      console.verbose(msg)
      console.log("ms spent waiting job:", t2-t1,"t=",t2 )
      t1 = t2
      queue_size++
      global_queue_size++
      console.log("global_queue_size INC",msg.id)

      return process_one_job( rapi, msg, process_s_expr, deployed_needs_dict, task_label ).then( res => {
        let t3 = performance.now()
        queue_size--
        console.log("============== process_one_job complete. task_id=",msg.id," time used for task:", t3-t2, "ms. N of jobs processed:",++counter,report() )
        return report_info( msg.id )
      }).catch( err => {
        let t3 = performance.now()
        queue_size--        
        console.log("============== process_one_job FAILED. task_id=",msg.id,"time used for task:", t3-t2, "ms. N of jobs processed:",++counter,report(),err )
        return report_info()
      })
    }
    fn.remember_needs_id = get_request_needs_ids( msg )

    
    //queue_executor( fn )
    //setTimeout( () => fn(),100 )
    fn()
    
  })

}

 // по задаче возвращает идентификаторы ее нидсов в форме словаря
function get_request_needs_ids( t ) {
    let acc = {}
    for (let name in t.arg) {
      let val = t.arg[name]
      if (val?.need) {
        let id = PPK.compute_need_id( val, true, t.local_env )          
        acc[id]={planned_for_task: t.id }
      }
    }
    return acc
  }

// создает функцию выполнения задач в очереди
// возвращает.. результат работы последней функции в очереди  
function mk_queue_fn() {
  let queue = []
  let running = false
  let result = ( fn ) => {
    if (running) {
      queue.push( fn )
    }
    else {
      running = true
      
      return fn().then( () => {
        
        running = false
        let next_fn = queue.shift()
        
        if (next_fn) 
            result( next_fn )
        
      })
    }
  }
  result.queue = queue
  result.size = () => queue.length
  return result
}

function igetenv( name, default_val ) {
  if (!process.env[name]) return default_val

  return parseInt( process.env[name] )
}

// выполнить 1 работу, и вернуть промису по готовности
function process_one_job( rapi, task, processing_function, deployed_needs_dict, runner_id ) {

  return new Promise( (job_resolve, job_fail) => {
  
	 // для визуализации - точка начала работы по задаче
         rapi.msg( {label: 'runner-started',
                   id: task.id,
                   runner_id,
                   hint: task.hint,
                   })

      let fn = ''

      uhr_handler = (err) => {
        uhr_handler = () => {} // чтобы 2 раза не ходить..
        let error_msg = err?.message || err || 'unknown error during process_one_job'
        console.log("runner: uhr-handler! error in function",err)
        //console.log('runner: sending runner-finished to ppk (with fail flag)',{id: task.id, runner_id, error_msg})
        console.log('runner: sending runner-finished to ppk (with fail flag). task=',task )
        console.error("runner: uhr-handler! error in function",err)
        console.error('runner: sending runner-finished to ppk (with fail flag). task=',task )
        //console.error('runner: sending runner-finished to ppk (with fail flag)',{id: task.id, runner_id, error_msg})
        rapi.msg( {label: 'runner-finished', 
                   q_priority: 0, id: task.id, runner_id, hint: task.hint,
                   success: false, error_msg })
        // todo message чето не стыкуется и выдает пустое значение

        // ощущение что эта вещь на уровне абстракции processing_function а не тутняя
        // F-RUNNER-CLEANUP-TASK-NEEDS-ON-FAIL
        console.log("traverse_expression to forget needs used by task")
        traverse_expression( task, task.env, (node,calling_node) => {
          if (node == task) return
          let id = compute_need_id( node, false, calling_node.arg )
          console.log("forgetting need",id)
          deployed_needs_dict.forget_need( id )
          console.log("forgetted",id)
        }, true, 1 )

        //console.log("marking job as failed-")
        //console.error("marking job as failed-")
        //job_fail(err)
        //setTimeout( () => job_fail(err),500 )
        job_fail( err )
        
      }

      let processing_result = processing_function( rapi, task, deployed_needs_dict )
      console.verbose("processing_result=",processing_result)

      //console.time("job_processing_function")
      let jt1 = performance.now()
      Promise.resolve(processing_result).then( item => {

          let time_used_ms = performance.now() - jt1
          //console.timeEnd("job_processing_function")
          console.verbose("runner. thus job result achieved. item=",item)

             //console.log('payloads uploaded, sending result to consumer and to the manager. task.id=',task.id)

             //else
             //  console.warn('runner: target label not specified, not sending result');
             // todo как-то сообщить чтобы задаче статус обновили, что она не executing а нечто другое
             // теперь отчитаемся
             // todo здесь нам надо по идее не runner-finished а почистить *-executing

             // вроде как оно не нужно стало? или можно совместить с runner-info
             // да нет, теперь с p-promise очень даже это и нужно..
             //setImmediate( () => {
             // ну вот это надо побыстрее теперь сделать - отчитаться о
             

             // без этой штуки на 20 единиц ускорение.. 670 - 690
               //if (false)
               rapi.msg( {label: 'runner-finished', 
                   result: item, // F-P-PROMISES todo opmitize получается мы шлем с каждым runner-finished.. дорого.. + payloads.. 
                   id: task.id, 
                   success: true, 
                   runner_id,
                   time_used_ms,
                   hint: task.hint
                   })

             //});
           //})


          // получается таки что мы - начали процессы выгрузки и сообщили что job-resolve
          // и через это - побыстрее получим след. задачу
          uhr_handler = () => {}

          //console.log("flagging job as resolved")
          job_resolve() // после отправки runner-finished
          
        }).catch( uhr_handler )


    }) // возвращаемый промис

}

// получается это таки внешний обход
// совместить с traverse_expression?
export function traverse_arg_tree( node, cb, depth=1000 ) {
   if (depth < 0) return
    for (let name in (node.arg || {})) {
      let item = node.arg[name]
      if (item?.code) {
        cb( item, name, node )
        traverse_arg_tree( item, cb, depth-1 )
      }
    }
}

// обход выражения
export function traverse_expression( node, env, cb, traverse_args=true, depth=1000, calling_node ) {
   //console.log("traverse_expression",{node,depth})
   // traverse_base=false,
   if (depth < 0) {
      //console.log("depth limit,exiting")
      return
   }

   cb( node, calling_node )

   if (traverse_args) 
   for (let name in (node.arg || {})) {      
      let item = node.arg[name]
      //console.log("checking arg",name,"item=",item) // 'have code=',item.code ? true : false)
      if (item?.code) {
        traverse_expression( item, env, cb, traverse_args, depth-1, node )
      }
   }

   let base_expression = env[ node.code ]
   if (base_expression) {
       //console.log('have base, going there?',!base_expression.fn)
       // вроде как в базовые не надо заходить - там js с текстом встретился
       if (!base_expression.fn)
          traverse_expression( base_expression, env, cb, traverse_args, depth-1, node )
   }
}

import {compute_need_id} from "ppk/api-lib.js"


function preprocess_s_expr( rapi,kv, deployed_needs_dict )
{

  traverse_expression( kv, kv.env, (node,calling_node) => {
    //console.log('hello traverse CB')
    if (node == kv) return
    let id = compute_need_id( node, true, calling_node.arg )
    console.verbose("TOUCHING WITH",kv.id)
    deployed_needs_dict.touch( id, kv.id )
  }, true, 1 )
}

// точка входа в вычисление выражений
// итак есть задача, описанная в пакете kv
// есть текущий словарь развернутых нидсов deployed_needs_dict
// и есть языковые среды, которые умеют разворачивать нидсы (выполнять задачи)

let fallback_js_env
let g_lang_envs

// выполнить задачу. но она может и не готова
// версия с 1 входом - input
function process_s_expr1( rapi,kv, deployed_needs_dict, language_envs )
{
  if (kv.arg.input) {
     //console.log(`CASE 1, id=${kv.id} waiting `,kv.arg.input)
     return rapi.wait_promise( kv.arg.input ).then( result => {
       console.log(`CASE 1 -> id=${kv.id} waited ok. going to process!`)
       //console.log(`CASE 1 -> id=${kv.id} waited ok. result=`,result)

       if (result.url && result.bytes_count) {
         let p_id = result.id || kv.arg.input.id || `payload:${result.url}` // F-KEEP-TASK-ID
         let limits = {ram: result.bytes_count}
         result = {need: true, code: "get-payload", arg: {payload_info:result}, id: p_id, limits }
         //console.log("result converted to",result)
       }

       // копируем результат
       kv.arg.input = result
       return process_s_expr_ready( rapi,kv,deployed_needs_dict, language_envs )
     })
  }
  // console.log("CASE 2")

  // нет там ожиданий
  return process_s_expr_ready( rapi,kv,deployed_needs_dict, language_envs )
}

// вход: выражение в форме поддерева (список аргументов)
// действие: находит и дожидается все обещания выражения и заменяет обещания на их результаты
// выход: преобразованный список аргументов. но меняется он прямо в исходном.
function wait_expr_promises( rapi, arg, add_result_conversion=true ) {
   let p_names = [] // массив имен в arg
   let p_arr = [] // массив соответствующих промисов
   let needs = []
   //console.log('checking task args',arg)
   for (let k in arg) {
     //console.log("checking k=",k)
     let v = arg[k]
     if (v?.p_promise) {
        p_names.push(k)
        p_arr.push(v)
     } else if (v?.need) {

       //if (v.code == "reuse-payloads")
       //    continue; // там по факту будут смотреть?

       // также необходимо дождаться всех нидов - зависимых от обещаний
       let p = wait_expr_promises( rapi, v.arg, v.code != "skip-payloads" && v.code != "reuse-payloads" ).then(new_arg => {
             
       })
       needs.push( p )
     }
   }

   if (p_names.length == 0 && needs.length == 0) 
      return Promise.resolve( arg )

   //console.log(`thus task is waiting `,p_names,p_arr,needs)

   let w_needs = Promise.all( needs )

   return w_needs.then( () => rapi.wait_all( p_arr ) ).then( result_arr => {
     //console.log(`CASE 1 -> id=${kv.id} waited ok. going to process! result_arr=`,result_arr)
     //console.log(`CASE 1 -> id=${kv.id} waited ok. result=`,result)

     for (let i=0; i<p_names.length; i++) {
       let result = result_arr[i]

       if (add_result_conversion) {
         if (result.payload_info) {
           //console.log("VAL PAYLOAD. PATCHING",p_arr[i],result)
           
           // идентификатор для "ниды" выражающей загрузку данных
           let url_sum = result.payload_info.map( x => x.url )
           // todo добавить бы сюда lang-env
           let p_id = p_arr[i].id || `payload::${url_sum}` // F-KEEP-TASK-ID
           // F-PAYLOAD-BYTES-COUNT
           let bytes_sum = result.payload_info.reduce((a, b) => a.bytes_count + b.bytes_count, {bytes_count:0}) 
           let limits = {ram: bytes_sum}
           // todo тут не совсем get_payload, т.к. в val может быть нечто бОльшее..
           result = {need: true, code: "restore-object", arg: result, id: p_id, limits }
         } // непосредственно пейлоад
       }

       // копируем полученный результат
       arg[ p_names[i] ] = result
     }
     return arg
     //return process_s_expr_ready( rapi,kv,deployed_needs_dict, language_envs )
   })  
}

// выполнить задачу. но она может и не готова
function process_s_expr( rapi,kv, deployed_needs_dict, language_envs )
{
   console.log("waiting task",kv.id) 
   return wait_expr_promises( rapi, kv.arg ).then( () => {
      console.log("task resolved",kv.id)
      return process_s_expr_ready( rapi,kv,deployed_needs_dict, language_envs )
   }) 
}

// выполнить готовую задачу
function process_s_expr_ready( rapi,kv, deployed_needs_dict, language_envs )
{
  //console.log("process_s_expr kv=",kv)
  //console.log("process_s_expr: expanded needs=",deployed_needs_dict.expanded_needs.keys())

  let needs_tasks = []
  let needs_args = {}
  let const_args = {}
  let after_task = []

  // сколько ресурсов надо на развертывание еще неразвернутых нидов
  // да и вообще на выполнение задачи.. надо что-то указать а то оно не будет чистить
  let extra_resources_required = { ram: 10*1024 }

  for (let name in kv.arg) {
     let val = kv.arg[name]

     if (val?.need) {
       let need_id = val.id
       if (!need_id) {
           console.error("no need id for arg name=",name,kv)
           return null
       }
       if (deployed_needs_dict.lock( need_id, kv.id ))
       {
          //console.log("LOCK OK need_id=",need_id)
          // нида уже развернута - доп. ресурсы не нужны
          let kkk = need_id
          after_task.push( () => deployed_needs_dict.unlock( kkk ) )
       } else {
          // нида не развернута, будем развертывать
          // 1 учтем ресурсы которые понадобятся
          // todo а тут кстати - нет информации от пейлоадов
          let need_resources
          let have_env = kv.env[ val.code ]          
          if (have_env) 
            need_resources = have_env.limits
          if (val.limits)
            need_resources = val.limits
          
          if (need_resources) {
            for (let r_name in need_resources) {
               extra_resources_required[ r_name ] ||= 0
               extra_resources_required[ r_name ] += need_resources[ r_name ]
            }
          }
          
          // 2 добавим развертывание ниды в список текущих задач
          needs_tasks.push( [need_id, val.code, val.arg, {} ])
       }
       needs_args[name] = need_id
     }
     else
       const_args[name] = val;
  }

  /*
  traverse_expression( kv, kv.env, (node,calling_node) => {
    //console.log('hello traverse CB')
    if (node == kv) return
    let id = compute_need_id( node, true, calling_node.arg )
    console.verbose("TOUCHING WITH",kv.id)
    // тут надо не тачить, а блокировать. чтобы не очистили TODO
    if (deployed_needs_dict.touch( id, kv.id ))
    {
      // нида развернута - её стало быть не надо запускать как задачу
    } else {
      tasks.push( {id, action_id: kv.code, const_args: kv.arg })
    }
  }, true, 1 )
  */

  if (!language_envs) {
    //if (!fallback_js_env) 
    //     fallback_js_env = new JsEnv( rapi )
    if (!g_lang_envs) {
      g_lang_envs = {}
      let on_clear_need = (id) => { // F-REUSE-PAYLOADS
        deployed_needs_dict.forget_need( id, false ) // там решили почистить - ну и мы чистим
      }
      g_lang_envs["js"] = new JsEnv( rapi )
      g_lang_envs["python"] = new SubprocessEnv( rapi,on_clear_need )
    }
    language_envs = g_lang_envs
  }

  //console.log("kv.code.lang=",kv.code.lang,"kv.code=",kv.code, "kv=",kv)

  let task_language_env = language_envs[ kv.lang_env ] // TODO
  if (!task_language_env)
    throw new Error(`Invalid lang_env parameter. kv.lang_env=${kv.lang_env}`)

  //let task_language_env = language_envs["python"] // TODO
  //let task_language_env = language_envs["js"]

  //let main_task = task_language_env.add_task( kv.id, kv.code, const_args, needs_args )

  //let main_task = null
  //needs_tasks.push( [kv.id, kv.code, const_args, needs_args] )

  // похоже надо еще раньше отражать ниды - чтобы по 2 раза задачи не ставить
  for (let t_arg of needs_tasks) {
     let need_id = t_arg[0]
     if (!deployed_needs_dict.expanded_needs.get( need_id ))
          deployed_needs_dict.save_expanded_need( need_id )
  }


  console.time("check_resources:"+kv.id)
  return deployed_needs_dict.check_resources( kv.id, extra_resources_required ).then( () => {
      console.timeEnd("check_resources:"+kv.id)
    // теперь есть ресурсы для всех новых нидов

      for (let t_arg of needs_tasks) {
         console.verbose("processing need_task t_arg=",t_arg)
         let nt = task_language_env.add_task( ...t_arg )
         // надо сразу отражать... чтобы - отсылать отчеты в менеджер
         deployed_needs_dict.save_expanded_need( t_arg[0] )

         nt.then( (need_info) => {
           // обновим ресурсы
           //console.log("!!!!! R1",need_info)
           deployed_needs_dict.save_expanded_need( t_arg[0], need_info?.resources, need_info?.cleanup )
         })
      }

      console.log("main_task add_task id=",kv.id,"main_tasks_solving=",main_tasks_solving)
      main_tasks_solving ++
      console.time("main_task-solve"+kv.id)
      let main_task = task_language_env.add_task( kv.id, kv.code, const_args, needs_args, true )
      // проба - запихнуть таки решение основных задач в некую локальную очередь задач ноды
      // чтобы - 
      /*
      let main_task = new Promise( (r,j) => {
         setImmediate( () => {
           task_language_env.add_task( kv.id, kv.code, const_args, needs_args, true ).then( res => r(res))
         }).catch( err => j(err))
      })
      */

      // вопрос. а если результат у задачи копеечный? мы его тож храним? а зачем?
      deployed_needs_dict.save_expanded_need( kv.id )
      //console.log("RUNNER ALGO EXTERNAL NEED RESOLVED",kv.id)

      // очищаем по завершению задачи
      main_task.then( (result) => {
        main_tasks_solving--
        console.timeEnd("main_task-solve"+kv.id)
        console.log("main_task finished",kv.id,"main_tasks_solving=",main_tasks_solving)
        //console.log("!!!!! R2",result)
        deployed_needs_dict.save_expanded_need( kv.id, result?.resources, result?.cleanup )
        for (let f of after_task) f()
        rapi.resolve_promise( {id:kv.id}, result )
      })

      return main_task; // промиса на результат задачи

  })  
}
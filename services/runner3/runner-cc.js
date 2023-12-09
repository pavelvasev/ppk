#!/usr/bin/env -S node --expose-gc --trace-warnings

// tood раннер должен выбирать такую задачу чтобы заюзать побольше нидсов своих
// F-RUNNER-VERBOSE - режим вывода информации побольше и поменьше.
//                    сделано путем создания метода console.verbose

import * as PPK from "../../client-api/client-api.js"
import { exec } from "node:child_process";

let RUNNER_ID = process.env.RUNNER_ID || "runner"
PPK.prefix_console_log( () => [`[${RUNNER_ID}]`,performance.now()] )
PPK.mk_console_verbose( process.env.VERBOSE )

let counter=0;


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

  let t1 = 0
  let report_info = (solved_task_id) => {
    t1 = performance.now()

    let deployed_needs_ids = {...deployed_needs_dict.expanded_needs}
    let get_aux = queue_executor.queue.map( fn => fn.remember_needs_id )
    for (let needs_of_q_task of get_aux) {
      // сначала ейные - ибо мб они там перезапишутся
      deployed_needs_ids = {...needs_of_q_task,...deployed_needs_ids}
    }

    //let rep = Object.values(deployed_needs_dict.expanded_needs).map( val => { return {id:val.id, resources:val.resources, access_time:val.access_time}})
    //console.log("reporting runner.","deployed needs",rep,"t=",t1 )
    let msg = {label:'runner-info',
               task_label,
               solved_task_id,
               runner_id: task_label,
               limits:deployed_needs_dict.resources_total,
               local_pusha_url: process.env.PUSHA_URL, // F-CONSIDER-PAYLOAD-LOCATION
               queue_size: queue_executor.size(),
               deployed_needs_ids }
    console.verbose("reporting runner.",msg,"t=",t1 )               
    return rapi.msg( msg ) // F_RUNNER_INFO_NEED_HINTS
               //deployed_needs_ids: deployed_needs_dict.get_keys() } )
  }
  report_info()

  rapi.query( task_label,{value:task_label} ).done( msg => {

    preprocess_s_expr( rapi,msg,deployed_needs_dict ) // тачи тут всякие
    // хотя эти тачи некорректные - более старые задачи будут иметь более приоритетный тач...
    // хотя можно и повернуть просто порядок задач будет.. хм..
    // а можно взять время кстати из очереди из места 0 вычесть и 1 микросекунду

    let fn = () => {
      let t2 = performance.now()
      console.log("============== process_one_job begin")
      console.verbose(msg)
      console.log("ms spent waiting job:", t2-t1,"t=",t2 )      
      return process_one_job( rapi, msg, process_s_expr, deployed_needs_dict, task_label ).then( res => {
        let t3 = performance.now()
        console.log("============== process_one_job complete. time used for task:", t3-t2, "ms. N of jobs processed:",++counter,report() )
        return report_info( msg.id )
      }).catch( err => {
        let t3 = performance.now()
        console.log("============== process_one_job FAILED. time used for task:", t3-t2, "ms. N of jobs processed:",++counter,report(),err )
        return report_info()
      })
    }
    fn.remember_needs_id = get_request_needs_ids( msg )

    
    queue_executor( fn )
    
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
        console.log('runner: sending runner-finished to ppk (with fail flag)',{id: task.id, runner_id, error_msg})
        console.error("runner: uhr-handler! error in function",err)
        console.error('runner: sending runner-finished to ppk (with fail flag)',{id: task.id, runner_id, error_msg})
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

      console.time("job_processing_function")
      let jt1 = performance.now()
      Promise.resolve(processing_result).then( item => {
          let time_used_ms = performance.now() - jt1
          console.timeEnd("job_processing_function")
          //console.log("runner. thus result achieved. item=",item)

          let result_payload_p
          if (item?.payload) {
            // это у нас 2 вида протокола на возврат значений. просто значение и словарь { result: ..., payload: ...}
            // это было раньше. а теперь я придумал что возвращается просто что-то
            // но если в этом что-то есть .payload то оно преобразуется в .payload_info..

            // надо отправить результаты на сервер.
            // потому что нам потом в 2 места отчитываться в runner-finished и в result-msg
            console.time("upload_result_payloads")
            result_payload_p = rapi.submit_payload( item.payload ).then( (payload_info_array) => {
              console.timeEnd("upload_result_payloads")
              item.payload_info = payload_info_array
              delete item['payload']
            })
          } else result_payload_p = Promise.resolve()

           //, (res,result_payload,process_next=true) => {
           
           // что и как мы скажем мозгам
           // попытка - после того как пошлем новый запрос
           // F-RUNNER-PARALLEL-QUERY

          result_payload_p.then( () => {
             console.log('payloads uploaded, sending result to consumer and to the manager. task.id=',task.id)
             if (task.result_msg)
               setImmediate( () => {
                 task.result_msg.result = item
                 rapi.msg( task.result_msg )
               })
             //else
             //  console.warn('runner: target label not specified, not sending result');
             // todo как-то сообщить чтобы задаче статус обновили, что она не executing а нечто другое
             // теперь отчитаемся
             // todo здесь нам надо по идее не runner-finished а почистить *-executing

             // вроде как оно не нужно стало? или можно совместить с runner-info
             // да нет, теперь с p-promise очень даже это и нужно..
             //setImmediate( () => {
             // ну вот это надо побыстрее теперь сделать - отчитаться о
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

          console.log("flagging job as resolved")
          job_resolve() // после отправки runner-finished

          })
          
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

import {compute_need_id} from "../../client-api/api-lib.js"


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

import { dirname } from 'path';
import { fileURLToPath } from 'url';

//configure( dirname(fileURLToPath(import.meta.url)) )
let __dirname = dirname( fileURLToPath( import.meta.url ) ) 

// это у нас на самом деле точка входа в вычисление выражений
// а функция вычисления выражений внутрях, в compute
function process_s_expr( rapi,kv, deployed_needs_dict )
{

  // 1. Необходимо продвинуть кеш всех используемых в этой задаче потребностей
  // 2. Но на самом деле похоже только их аргументов. Не входя в "тела".. или входя?..
  // 3. Но на самом деле - ток первый уровень надо обойти в целях touch. И только аргументы..
  //    Потому что - нида не не будет вызывать свое тело. Она уже сделана. Уже вычислена. Ей нет нужды идти в свое тело.
  // хотя может быть и есть.. мало ли что она там использует
  //console.log("entering touch")
  traverse_expression( kv, kv.env, (node,calling_node) => {
    //console.log('hello traverse CB')
    if (node == kv) return
    let id = compute_need_id( node, true, calling_node.arg )
    console.verbose("TOUCHING WITH",kv.id)
    deployed_needs_dict.touch( id, kv.id )
  }, true, 1 )
  // 2. Необходимо очистить кеш чтобы вместить потребности текущей задачи и саму задачу
  // начнем с самой задачи
  deployed_needs_dict.check_resources( null, kv.limits )
  // todo по идее тут надо пройтись еще по всему списку определений основной операции
  // и либо их просуммировать с лимитами kv.limits либо если они хранятся - то использовать их id..

  /*
  traverse_expression( kv, kv.env, (node,calling_node) => {
    if (node == kv) return
    let limits_rec = kv.env[ "limits:" + node.code ]
    if (typeof(limits_rec) === "string") limits_rec = eval( limits_rec )
    let item_limits = limits_rec.bind ? limits_rec(node.args) : limits_rec
    let id = compute_need_id( node, false, calling_node.arg )
    deployed_needs_dict.check_resources( id,item_limits )
  })*/

  // own_needs_rec таблица записей о локальных нидсах для кода code
  // needs_table это словарь с описанием как строить нидсы
  // все ниды и задачи в итоге вычисляются этой compute_fn
  let compute_fn = ( code, arg, env, this_id ) => {

    let snode = { arg }
    let own_needs_rec = {}
    traverse_arg_tree( snode, (node,name) => {
      own_needs_rec[ name ] = node
    },1)

    //console.log("compute_fn called",{code,arg,own_needs_rec,needs_table})
    let ppk = rapi

    let called_need = env[ code ]

    if (!called_need) {
      console.error('process_s_expr: no need of type',code,'in env')
      //throw `process_s_expr: no need of type '${code}' in env`
      return Promise.reject( `process_s_expr: no need of type '${code}' in env` )
    }

    /*
    let called_need_limits = env[ "limits:" + code ]
    if (called_need_limits) {
      if (typeof(called_need_limits) === "string") 
          called_need_limits = eval( called_need_limits ) // это функция
      deployed_needs_dict.prepare_resources( this_id, called_need_limits )
    }*/

    let fn = called_need.fn 
    fn ||= ( arg ) => {
      // кажется в этом месте надо - закопировать еще аргументы. ехъ 
      // todo оптимизировать это все с учетом тела deploy_need
      let called_need_copy = {...called_need}
      called_need_copy.arg = {...called_need_copy.arg}
      for (let n in arg)
        called_need_copy.arg[ n ] = arg[n]
      console.verbose("merged args while calling is", arg)

      /*
         rapi.msg( {label: 'need-status',
                   status:'deploy',
                   id: kv.id,
                   runner_id,
                   hint: kv.hint,
                   })*/
      

      // т.е. это передача управления вызванной операции (уход в абстракцию)
      return deployed_needs_dict.deploy_need( called_need_copy, env, compute_fn )
    }

    // вычисляем аргументы (кониды вычислены ранее)
    let p_needs = deployed_needs_dict.prepare_local_needs( own_needs_rec, env, compute_fn )
    

    // когда аргументы готовы передаем управление базовой ниде
    return p_needs.then( local_needs => {
      //console.log("compute_fn local_needs done, ",local_needs)

      // заменяем ссылки на ниды - их значениями 
      // при этом создадим новую структуру, чтобы старая сохранилась тоже (надо для uhr-handler)
      let narg = {...arg, ...local_needs}
      //for (let local_need_id in local_needs)
      //  narg[ local_need_id ] = local_needs[ local_need_id ]

      //for (let local_need_id in called_need)

      //console.log("prepared args and going to pass control",{arg})
      // console.log("compute_fn needs prepared, entering own fn",{code,kv,arg})
      console.verbose("process_s_expr: compute_fn needs prepared, entering own fn",{code})

      return fn( narg, rapi ); // fn
    })
  }

  // наверное вынести в мейн..
  kv.env ||= {}
  kv.env[ 'js' ] = {
    fn: (arg) => {
      //console.log('thus called js.',arg )
      let f = null
      try {
        f = eval( arg.text )
      } catch (err) {
        console.error("error in js need:",arg.text)
        throw err
      }
      return f( arg )
    }
  }

  // будучи нидой, должна возвращщать промису.. типа нида подготовилась..
  kv.env["prepare_python"] = {
    fn: (arg,rapi) => {
      //console.log("QQQQQQQQQQQQQQQQQ arg=",arg,"rapi=",rapi)
      //console.trace()
      //return Promise.resolve( (a) => 333 )
      //return (a) => Promise.resolve( console.log("thus python called") )

      // вообще так любой интерпретатор можно запускать, не только питона
      // + ну может это и в Starter.start разместить? хотя вряд ли, тут много специфики.. но напрашивается подпроцесс-клиент-рапи паттерн..
      return import('node:child_process').then( modul => {
          let prgpath = __dirname + "/python-func.py"

          return new Promise( (resolve,reject) => {
            
          let his_task_queue = ""
          let my_guid = rapi.generate_uniq_query_id("interrunner")

          // в этот момент я думаю что мб Dask не так уж и не прав, создавая каналы на основе сетевых адресов
          // мол, зачем нам тут - консультации с центром (а query и т.п. через них идут, хоть и разово)
          rapi.query( my_guid ).done( msg => {            
            if (msg.stage == "getcode")
              rapi.reply( msg, arg )
            else if (msg.stage == "set_task_queue")
            {
              his_task_queue = msg.python_task_id
              rapi.reply( msg, true )
              resolve( python_function )
            } else console.log("prepare_python: unknown msg",msg)
          })

          let args = [rapi.url, my_guid] // так-то идея очереди: ws://urla/channel/.....

          let prg = modul.spawn( prgpath, args, {stdio: ['ignore','pipe','pipe']} )
          let prg_exited = false

          let next_cb = () => {}
          let exit_cb = reject // () => {}

          let stderr_acc = []
          prg.stderr.on('data', (data) => {
            data = data.toString()
            console.log(`>>>>> python-func subprocess [${prg.pid}] `,"stderr:",data)
            if (stderr_acc.length > 50) stderr_acc.shift() // не будем много копить
            stderr_acc.push( data )
          });
          prg.on('error', (data) => {
            console.log(`>>>>> python-func subprocess [${prg.pid}] `,"error:",data)
            exit_cb("exitcode=error")
          });
          prg.on('spawn', (data) => {
            console.log(`>>>>> python-func subprocess [${prg.pid}] `,"spawned!")
          });
          prg.on('exit', (code,signal) => {
            console.log(`>>>>> python-func subprocess [${prg.pid}] `,"exited! code=",code,signal)
            prg_exited = true // почему-то killed там не всегда выставляется

            if (code != 0 || code == null) {
              let str = stderr_acc.join("\n")
              exit_cb( {msg: 'prepare_python subprocess error', runner_id: RUNNER_ID, exitcode:code, pid:prg.pid, stderr:str} )
              //exit_cb(`exitcode=1 pid=${prg.pid}. stderr=${str}`)
            }
              //throw "suprocess serios error!"
          });

          prg.stdout.on('data', (data) => {
            data = data.toString()
            console.verbose(">>>>> python-func subprocess stdout:",data)
            //next_cb( data );
            next_cb = () => {}            
          });

          let python_function = ( args ) => {
            /*
            prg.stdin.cork()
            let str = JSON.stringify( args )
            prg.stdin.write( str )
            prg.stdin.uncork() // такое у них флаш
            //console.log("thus stringified args=",args)
            */
            return new Promise( (f_resolve,f_reject) => {
              args = {...args}
              // временный хак а то njit грустно с лишними аргументами
              delete args['text']
              delete args['had_coneeds']

              rapi.request( { "label":his_task_queue, "args":args } ).done( result => {
                //console.log("python_function done, result=",result)
                // если там по дороге возникнут ошибки программы - отмена работы фукнции сей
                exit_cb = f_reject

                if (result.success)
                    f_resolve( result.value )
                else {
                    let str = stderr_acc.join("\n")
                    let q = {msg: result.msg, runner_id: RUNNER_ID, pid:prg.pid, stderr:str}
                    f_reject( q )
                    //f_reject( result.msg )
                  }
              })
            })
          }

          python_function.cleanup = () => {
            console.verbose("python_function.cleanup called! !!!!!!!!!!!!!!!!!!!!!! @@@@@@@@@@@@@@@@2 pid=", prg.pid)
            if (prg_exited) {
              console.log("prg_exited, doing nothing")
              return
            }
            return new Promise( (resolv,reject) => {
              // такая техника.. надо дождаться завершения.
              prg.on('exit',() => {
                resolv(true)
              })
              prg.kill() // sends SIGTERM by default
              console.log('waiting for actual python_function subprocess exit.. pid=',prg.pid)
            })            
          } // cleanup

          python_function.resources_usage = () => {
            return { "RAM":100*1024*1024}
          }

          }) // promise
      }) // import
    } // fn
  }

  return compute_fn( kv.code, kv.arg, kv.env )
}
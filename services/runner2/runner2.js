#!/usr/bin/env -S node --expose-gc --trace-warnings 
//--inspect 

// tood раннер должен выбирать такую задачу чтобы заюзать побольше нидсов своих
// F-RUNNER-VERBOSE - режим вывода информации побольше и поменьше.
//                    сделано путем создания метода console.verbose

import * as PPK from "ppk"
import {compute_need_id} from "ppk/api-lib.js"

import * as PL from "../promises/lib.js"

import * as CHILDPROCESS from "node:child_process"
import { SubprocessEnv, JsEnv } from "./lang-env.js"

import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { hrtime } from 'node:process';

//configure( dirname(fileURLToPath(import.meta.url)) )
let __dirname = dirname( fileURLToPath( import.meta.url ) ) 

let RUNNER_ID = process.env.RUNNER_ID || "runner"
PPK.prefix_console_log( () => [`[${RUNNER_ID}]`,performance.now()] )
PPK.mk_console_verbose( process.env.VERBOSE )

//const verbose_level_2 = true;
const verbose_level_2 = process.env.VERBOSE ? true : false;

let counter=0;
let global_queue_size = 0
let main_tasks_solving = 0
let uhr_handler = () => {}

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
    PPK.connect( RUNNER_ID,{url:process.env.MOZG_URL, submit_payload_url: process.env.PUSHA_URL}, 
            process.env.VERBOSE ).then(rapi => {
    //PPK.connect( RUNNER_ID,process.env.MOZG_URL, process.env.VERBOSE, process.env.PUSHA_URL ).then(mozg => {
    
      if (current_ppk) {
        console.log('restart_connection: current_ppk is already assigned while we was closing it...')
        process.exit(1)
      }
    
      current_ppk = rapi
      console.log("connected")
      let report_time = new ReportTime()


      process_one_job_loop( rapi, () => {
        return `fps: ${ report_time.tick() }`
      }, dn)

      rapi.ws.on('close', () => {
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

  console.log("starting local promises")
  PL.promises_service_logic( rapi, task_label )

  let env = {}
  rapi.shared("defines").subscribe( (values) => {
    env = {}
    values.forEach( v => env[v.name] = v.value )
    console.log("defines env updated. values=",values,"have names:",Object.keys(env))
  })

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

  // это забавная фишка - чистить заранее просто так.
  // параметр - частота.
  setInterval( () => {
    // console.log("checking resources just in case")
    let extra_resources_required = {ram:100*1024*1024} // подчищаем чтобы было АТЬ мегабайт хотя бы
    deployed_needs_dict.check_resources( null, extra_resources_required )
  },1000)

  let t1 = time_fn()

  function time_fn() {
    //return hrtime.bigint()
    return performance.now()
  }

  function fn (msg) {
      let t2 = time_fn()
      if (verbose_level_2) {
        console.log("============== process_one_job begin. task_id=",msg.id,"queue_size=",queue_size,"global_queue_size=",global_queue_size,"main_tasks_solving=",main_tasks_solving)
        //console.verbose(msg)
        console.log("ms spent waiting job:", t2-t1,"t=",t2 )
      }
      t1 = t2
      queue_size++
      global_queue_size++
      console.verbose("global_queue_size INC",msg.id)

      return process_one_job( rapi, msg, process_s_expr, deployed_needs_dict, task_label ).then( res => {
        global_queue_size-- // F-SHORTER-QUEUE
        console.verbose("global_queue_size DEC",msg.id)
        let t3 = time_fn()
        queue_size--
        if (verbose_level_2)
            console.log("============== process_one_job complete. task_id=",msg.id," time used for task:", t3-t2, "ms. N of jobs processed:",++counter,report() )
        return report_info( msg.id )
      }).catch( err => {
        global_queue_size-- // F-SHORTER-QUEUE
        console.verbose("global_queue_size DEC",msg.id)
        let t3 = time_fn()
        queue_size--
        if (verbose_level_2)
            console.log("============== process_one_job FAILED. task_id=",msg.id,"time used for task:", t3-t2, "ms. N of jobs processed:",++counter,report(),err )
        return report_info()
      })
    }  

  
  rapi.query( task_label,{value:task_label} ).done( msg => {

    if (verbose_level_2) 
      console.log('Rapi query done',JSON.stringify( msg,null,2 ) )

    msg.env = env // F-SHARED-DEFINES а добавили в msg потому что потом по коду исопльзуется много кге

    preprocess_s_expr( rapi,msg,deployed_needs_dict ) // тачи тут всякие
    // хотя эти тачи некорректные - более старые задачи будут иметь более приоритетный тач...
    // хотя можно и повернуть просто порядок задач будет.. хм..
    // а можно взять время кстати из очереди из места 0 вычесть и 1 микросекунду
    
    fn.remember_needs_id = get_request_needs_ids( msg )
    
    fn( msg )    
  }).then( () => {
      // сообщаем о себе только после размещения query на таск-лейбл
      // иначе могут успеть прислать уже задачу
      // F-RUNNERS-LIST
      rapi.shared("runners-list").submit( { id: task_label } )
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
        traverse_expression( task, task.env, (node,calling_node,is_base) => {
          if (node == task) return
          if (is_base) return
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

      // processing_function == process_s_expr
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
/*
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
*/

// обход выражения
export function traverse_expression( node, env, cb, traverse_args=true, depth=1000, calling_node, is_base ) {
   //console.log("traverse_expression",{node,depth})
   // traverse_base=false,
   if (depth < 0) {
      //console.log("depth limit,exiting")
      return
   }

   cb( node, calling_node, is_base )

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
          traverse_expression( base_expression, env, cb, traverse_args, depth-1, node, true )
   }
}


function preprocess_s_expr( rapi,kv, deployed_needs_dict )
{

  traverse_expression( kv, kv.env, (node,calling_node, is_base) => {
    //console.log('hello traverse CB')
    if (node == kv) return
    if (is_base) return // корневое..
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

/*
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
*/

// вход: выражение в форме поддерева (список аргументов)
// действие: находит и дожидается все обещания выражения и заменяет обещания на их результаты
// выход: преобразованный список аргументов. но меняется он прямо в исходном.
// update: жизнь показала что надо выдавать свежий arg и не трогать старый
// потому что мы стали сабмитить графы
function wait_expr_promises( rapi, arg, add_result_conversion=true ) {

   //console.log("wait_expr_promises! arg=",arg)

   let p_names = [] // массив имен в arg
   let p_arr = [] // массив соответствующих промисов
   let needs = []

   arg = {...arg} // возвращаем свежий список
   
   //console.log('checking task args',arg)
   for (let k in arg) {
     //console.log("checking k=",k)
     let v = arg[k]
     if (v?.p_promise) {
        p_names.push(k)
        p_arr.push( rapi.to_local_promise(v) )
     } else if (v?.need) {

       //if (v.code == "reuse-payloads")
       //    continue; // там по факту будут смотреть?

       console.log("need detected. goint to it's inputs. need=",v)
       // также необходимо дождаться всех нидов - зависимых от обещаний
       let p = wait_expr_promises( rapi, v.arg, v.code != "skip-payloads" && v.code != "reuse-payloads" ).then( resolved_need_args => {
         return {...v, arg: resolved_need_args } // новое тело ниды
       })
       p_names.push( k )
       p_arr.push( p )
       //needs.push( p )
     } else if (v?.cell) {
       // F-TASK-CELL чтение ячеек на вход
       let p = get_reading_cell( rapi, v );
       let p_r = p.next() // заказываем чтение следующего значения
       p_names.push( k )
       p_arr.push( p_r )
       arg.have_cells = true
     }
   }

   if (p_names.length == 0 && needs.length == 0) 
      return Promise.resolve( arg )

   console.log(`thus task is waiting `,p_names,p_arr)

   //let w_needs = Promise.all( needs )

   //return w_needs.then( () => Promise.all( p_arr ) ).then( result_arr => {
   return Promise.all( p_arr ).then( result_arr => {
     console.log(`CASE 1 -> waited ok. going to process! names=`,p_names,"result_arr=",result_arr)
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
   console.log("process_s_expr on kv=",kv) 
   if (verbose_level_2)
       console.time("wait_task_args"+kv.id)
   return wait_expr_promises( rapi, kv.arg ).then( (new_arg) => {
      console.log("task resolved",kv.id, new_arg)
      if (verbose_level_2)
         console.timeEnd("wait_task_args"+kv.id)

      kv.arg = new_arg
      return process_s_expr_ready( rapi,kv,deployed_needs_dict, language_envs )
   }) 
}

// выполнить готовую задачу
// разворачивает ниды и затем запускает основную задачу
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

  // F-CALL-DEFINE
  // наивный алгоритм, который сработает видимо только для compute
  // т.о. мы тут рассчитываем что там стоит compute в define, у которого аргумент func
  // и сообразно теперь мы и проводим замену. ну потянет пока.
  let operation_expr = kv.env[ kv.code ]
  if (operation_expr) {
    //console.log("kv.arg=",kv.arg)
    // console.log("operation_expr=",operation_expr)
    // операция определена в окружении defines
    kv.arg = {...kv.arg, ...operation_expr.arg }
    kv.code = operation_expr.code
    //console.log("merged kv arg", kv.arg)
  }

  let preparing_needs = {}
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
          
          // если такое need-id уже было в аргументах, его второй раз добавлять не надо
          // но соответсвие все-равно выставить надо, см. ниже needs_args[name] = need_id
          if (preparing_needs[ need_id ])
          {
            // вроде бы эта ситуация ОК
            //console.warn("Duplicate need_id in args. Is it OK? need_id=",need_id, "task=",JSON.stringify(kv,null,"  ") )
          }
          else {
            needs_tasks.push( [need_id, val.code, val.arg, {} ])
            preparing_needs[ need_id ] = true
          }
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
      // on_clear_need это получается мы передаем апи. ок.

      g_lang_envs["js"] = new JsEnv( rapi, on_clear_need )
      g_lang_envs["python"] = new SubprocessEnv( rapi,on_clear_need )
    }
    language_envs = g_lang_envs
  }

  //console.log("kv.code.lang=",kv.code.lang,"kv.code=",kv.code, "kv=",kv)

  let task_language_env = language_envs[ kv.lang_env ] // TODO
  if (!task_language_env) {
    console.error(`Invalid lang_env parameter. kv.lang_env=${kv.lang_env}`)
    console.error("kv=",kv)
    throw new Error(`Invalid lang_env parameter. kv.lang_env=${kv.lang_env}`)
  }

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

  if (verbose_level_2) console.time("check_resources:"+kv.id)
  return deployed_needs_dict.check_resources( kv.id, extra_resources_required ).then( () => {
      if (verbose_level_2) console.timeEnd("check_resources:"+kv.id)
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

      //console.log("main_task add_task id=",kv.id,"main_tasks_solving=",main_tasks_solving)
      main_tasks_solving ++
      if (verbose_level_2) console.time("main_task-solve"+kv.id)
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
        if (verbose_level_2) console.timeEnd("main_task-solve"+kv.id)
        //console.log("main_task finished",kv.id,"main_tasks_solving=",main_tasks_solving)
        //console.log("!!!!! R2",result)
        deployed_needs_dict.save_expanded_need( kv.id, result?.resources, result?.cleanup )
        for (let f of after_task) f()

        // F-TASK-CELL запись в ячейку  
        if (kv.output_cell) {
           let cell = get_writing_cell( rapi, kv.output_cell )
           console.log("SUBMITTING TO CELL", result)
           cell.submit( result )
           return // режим ячейки - промису не трогаем
           // todo добавить в клинап - забытие ячейки.
        }

        // F-PROMISES-CHANNELS
        rapi.resolve_promise( {id:kv.id, channel_id: kv.channel_id}, result )
      })

      return main_task; // промиса на результат задачи

  })
}

// F-TASK-CELL
// функции доступа к ячейкам. получается раннер их эксплуатирует
// и получается по идее - надо бы вычищать ненужных. особенно читающих.

let writing_cells = new Map();

function get_writing_cell( rapi, cell_info ) {
  let val = writing_cells.get( cell_info.id )
  if (val) return val;
  val = rapi.create_cell( cell_info.id )
  writing_cells.set( cell_info.id, val )
  return val
}

let reading_cells = new Map();

function get_reading_cell( rapi, cell_info ) {
  let val = reading_cells.get( cell_info.id )
  if (val) return val;
  val = rapi.read_cell( cell_info.id )
  reading_cells.set( cell_info.id, val )
  return val
}
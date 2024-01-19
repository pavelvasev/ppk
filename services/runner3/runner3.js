#!/usr/bin/env -S node --expose-gc --trace-warnings 
// --inspect 

// tood раннер должен выбирать такую задачу чтобы заюзать побольше нидсов своих
// F-RUNNER-VERBOSE - режим вывода информации побольше и поменьше.
//                    сделано путем создания метода console.verbose

import * as PPK from "ppk"
import {compute_need_id} from "ppk/api-lib.js"

import * as PL from "../promises/lib.js"

import * as CHILDPROCESS from "node:child_process"
import * as OS from "node:os"

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
//let uhr_handler = () => {}

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

      let processor = new Processor( rapi )

      process_one_job_loop( rapi, () => {
        return `fps: ${ report_time.tick() }`
      }, dn, processor )

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

function process_one_job_loop( rapi, report, deployed_needs_dict, processor ) {

  let task_label = rapi.generate_uniq_query_id('task_label')

  // idea мб как-то попечатать cpu к которому есть affinity?
  // ну или башем https://serverfault.com/questions/462454/on-linux-how-do-i-the-check-cpu-affinity-of-a-process-and-its-threads
  console.error("my host=",OS.hostname(),"pid=",process.pid)
  console.log("starting local promises server")
  PL.promises_service_logic( rapi, task_label )

  let env = {}
  rapi.shared("defines").subscribe( (values) => {
    env = {}
    values.forEach( v => env[v.name] = v.value )
    console.log("defines env updated. values=",values,"have names:",Object.keys(env))
    processor.set_env( env )
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

      return process_one_job( rapi, msg, deployed_needs_dict, task_label, processor ).then( res => {
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

    // preprocess_s_expr( rapi,msg,deployed_needs_dict ) // тачи тут всякие
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
function process_one_job( rapi, task, deployed_needs_dict, runner_id, processor ) {

  return new Promise( (job_resolve, job_fail) => {
  
	 // для визуализации - точка начала работы по задаче
         rapi.msg( {label: 'runner-started',
                   id: task.id,
                   runner_id,
                   hint: task.hint,
                   })

      let fn = ''

      let uhr_handler = (err) => {
        //uhr_handler = () => {} // чтобы 2 раза не ходить..
        let error_msg = err?.message || err || 'unknown error during process_one_job'
        console.log("runner: uhr-handler! error in function. err=",err)
        //console.log('runner: sending runner-finished to ppk (with fail flag)',{id: task.id, runner_id, error_msg})
        console.log('runner: sending runner-finished to ppk (with fail flag). task=',JSON.stringify(task,null,"  ") )
        console.error("runner: uhr-handler! error in function. err=",err)
        console.error('runner: sending runner-finished to ppk (with fail flag). task=',JSON.stringify(task,null,"  ") )
        //console.error('runner: sending runner-finished to ppk (with fail flag)',{id: task.id, runner_id, error_msg})
        
        rapi.msg( {label: 'runner-finished',
                   q_priority: 0, id: task.id, runner_id, hint: task.hint,
                   success: false, error_msg })
        
        job_fail( err )
        
      }

      let processing_result =  processor.process_record( task )
      console.verbose("processing_result=",processing_result)

      //console.time("job_processing_function")
      let jt1 = performance.now()
      Promise.resolve(processing_result).then( item => {

          let item_orig = item;

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

            // пункт 2 - регистрируем пейлоады для выгрузки               
            // вопрос  а может и не надо? мб достаточно того что в cache оно сидит?
               // и если кому-то нужен результат, ну пусть обращается к нам
               // по протоколам доступа к кешам. и мы ему с пейлоадами пришлем
               // или дадим провести свои вычисления локально
               // idea

            let result_payload_p  // F-UNFAT-OBJECT

            if (item?.payload) {
              console.verbose("payload!")
              // это у нас 2 вида протокола на возврат значений. просто значение и словарь { result: ..., payload: ...}
              // это было раньше. а теперь я придумал что возвращается просто что-то
              // но если в этом что-то есть .payload то оно преобразуется в .payload_info..

              // надо скопировать самое себя - потому что мы обезжириваем теперь
              // а объект value запомнился выше в ниде
              item = {...item}

              //console.time("jsenv: upload_result_payloads")
              result_payload_p = rapi.submit_payload_inmem( item.payload ).then( (payload_info_array) => {
                  //console.timeEnd("jsenv: upload_result_payloads")
                  item.payload_info = payload_info_array
                  delete item['payload'] // а так зачем делать?...
              })
            } else 
            if (item?.buffer) { // была идея - привести к .payload и далее работать единообразно. ну метко поставить - для распаковки
              console.verbose("buffer!")
              //console.time("jsenv: upload_result_payloads (single)")              
              result_payload_p = rapi.submit_payload_inmem( item ).then( (payload_info) => {
                  //console.timeEnd("jsenv: upload_result_payloads (single)")
                  //let c1 = value.
                  item = {single_payload:true, payload_info: [payload_info]}
                  // , cleanup: value.cleanup, resources: value.resources
              })
            } else
               result_payload_p = Promise.resolve()

            //let tail_time = this.stats_time() - tt2
            //console.log({tail_time})
            //this.stats.tail += tail_time

            return result_payload_p.then( () => {

              // очищаем по завершению задачи
              //main_task.then( (result) => {
                //main_tasks_solving--
                //if (verbose_level_2) console.timeEnd("main_task-solve"+kv.id)
                //console.log("main_task finished",kv.id,"main_tasks_solving=",main_tasks_solving)
                //console.log("!!!!! R2",result)
                //deployed_needs_dict.save_expanded_need( kv.id, result?.resources, result?.cleanup )
                
                // !!! todo for (let f of after_task) f()

                // F-TASK-CELL запись в ячейку  
                if (task.output_cell) {
                   let cell = get_writing_cell( rapi, task.output_cell )

                   processor.cache.set( cell.id, processing_result )

                   //console.log("saving to cache, id=cell.id=",cell.id )
                   console.verbose("SUBMITTING TO CELL",cell.id )
                   cell.submit( item )
                   //return // режим ячейки - промису не трогаем
                   // todo добавить в клинап - забытие ячейки.
                } else {
                  console.verbose("SUBMITTING TO PROMISE",task.id)

                  // сохраняем локально...
                  processor.cache.set( task.id, processing_result)
                  // F-PROMISES-CHANNELS
                  rapi.resolve_promise( {id:task.id, channel_id: task.channel_id}, item )
                }

            }) // выгрузка пейлоады
          
          // получается таки что мы - начали процессы выгрузки и сообщили что job-resolve
          // и через это - побыстрее получим след. задачу
          //uhr_handler = () => {}

          //console.log("flagging job as resolved")
          job_resolve() // после отправки runner-finished
          
        }).catch( uhr_handler )


    }) // возвращаемый промис

}


class Processor {
  constructor( rapi ) {
    this.rapi = rapi
    this.cache = new Map()
  }

  // todo - update env
  set_env( env ) {
    this.env = env
    env['compile_js'] = this.compile_js.bind(this)
    env['compute']    = this.compute.bind(this)
    env['skip_payloads'] = this.skip_payloads.bind(this)
    env['restore_object'] = this.restore_object.bind(this)
    env['reuse_payloads'] = this.reuse_payloads.bind(this)
    env['read_promise'] = this.read_promise.bind(this)
    env['read_cell'] = this.read_cell.bind(this)
    //this.builtin_env['get-payload'] = this.get_payload.bind(this)    
  }

  // в кеше храним обещания - чтобы убирать дублирующиеся вычисления
  do_cache( id,  value_fn ) {
    if (this.cache.has( id )) {
      //console.log("cache hit: ",id)
      return this.cache.get( id )
    }

    let p_value = value_fn()

    this.cache.set( id, p_value) // todo сюда можно вставить ссылку-причину
    return p_value; // в кеш стало быть надо класть обещания. заодно дубликаты потрем
  }

  process_record( record, restore ) {
    return this.need( record )
  }

  need( record ) {
    let need_func = this.env[ record.code ]
    if (!need_func) {
      console.error("Processor: failed to find need for code :",record.code)
      return null
    }
    if (typeof(need_func) === "object") {      
      record.arg = {...record.arg, ...need_func.arg }
      record.code = need_func.code
      return this.need( record )
    }

    let fn = () => this.resolve_args( record.arg ).then( args => {
      return need_func( args )  
    })

    if (record.arg.disable_cache)
      return fn()

    return this.do_cache( record.id, fn )
  }

  // process_record
  resolve_args( e_args ) {  
    let p_names = []
    let p_args = []
    for (let name in e_args) {
      let r = e_args[name]
      if (r?.need) // нида
      {
        let p_value = this.need( r ) // вычисление значения
        p_args.push( p_value )
      }
      else { // константа
        p_args.push( r )        
      }
      p_names.push( name )
    }

    let args = {}
    return Promise.all( p_args ).then( values => {
      p_names.map( (name,index) => args[name] = values[index])      
      //console.log("resolve_args: input=",e_args,"args=",args,"values=",values,"names=",p_names)
    }).then( () => args )
  }

  //////////////////////////////////////

  read_promise( args ) {
    return this.rapi.to_local_promise( args.input )
  }
  read_cell( args ) {
    return  get_reading_cell( this.rapi, args.input ).next()    
  }

  compute( args ) {
    let f = args.func
    if (typeof(f) !== "function") {
      console.error("compute: func is not a function! args=",args)
      throw new Error("compute: func is not a function!")
    }
    let result = f( args )
    return result    
  }

  compile_js( args ) {
    let f = null
    let rapi = this.rapi
    try {
      //console.error('compile_js: args.text=',args.text)
      f = eval( args.text )
      //console.error("compile success!")
    } catch (err) {
      console.error("JsEnv: error in js need:",args.text)
      throw err
    }
    return f
  }

  skip_payloads( args ) {
    return args.input
  }

  restore_object( args ) {
      let input = args.input
      let info = input.payload_info
      
      return this.rapi.get_payload( info ).then( payloads => {
        input.payload = payloads
        if (input.single_payload) // F-RESTORE-OBJECT
            return payloads[0]
        return input
      })
  }

  reuse_payloads( args ) 
  {
      console.verbose("REUSE-PAYLOADS ARGS RESOLVED",args)
      let p = args.input;
      let id = args.input_id;

      console.verbose("checking local cache. id=",id)

      if (this.cache.has(id) )
      {
        let k = this.cache.get( id )
        console.verbose("REUSE-PAYLOADS: HAS LOCAL",k)
        return k.then( value => {
          this.cache.delete( id )
          //this.on_clear_need( id ) // забудьте о сей промисе - мы ее поели
          delete value['payload_info']
          return value
        })
      }

      if (!p.payload_info) {
        console.error("reuse_payloads: input argument have no payload_info!",p)        
        console.log("reuse_payloads: input argument have no payload_info!",p)
      }


      //if (p.payload_info)
      //if (this.rapi.payloads_inmem.)

      //console.log("REUSE-PAYLOADS: NO LOCAL")

      // итак промисы у нас локально нет
      // но тут еще может сработать гипертранспорт пейлоадов..
      if (!args.alloc) {
        console.verbose("REUSE-PAYLOADS: DOWNLOADING",JSON.stringify(p.payload_info))
        // надо обязательно скачать
        return this.rapi.get_payloads( p.payload_info ).then( bufs => {
           p = {...p}
           p.payload = bufs;
           console.verbose("DOWNLOADED: ",p)
           //p.resources = todo
           delete p['payload_info'];
           // F-RESTORE-OBJECT
           if (p.single_payload) return p.payload[0]
           return p;
           // кстати а вопрос.. надо же на удаленном теперь это стереть стало быть?
        })
      }

      // можно аллоцировать - качать не обязательно
      console.verbose("REUSE-PAYLOADS: ALLOCATING")

      p = {...p}
      
      // чтобы публиковать заново.. хм.. todo а надо ли так? 
      // ну вроде как надо. потому что если id публикации тот же оставить
      // то удаленные узлы могут думать что у них есть эта версия данных (если они закачали раньше)
      // ну так стало быть. мы осознанно пере-публикуем эти данные.

      let payload = []
      for (let k of p.payload_info) {
        /*
        let bn = k.length / k.bytes_count;
        let cnt = Math.floor( k.bytes_count / bn )
        let data = new Float32Array( cnt ) // ха!
        */
        let context = typeof window === "undefined" ? global : window;
        let data = new context[ k.type ]( k.length );
        payload.push( data )
      }
      p.payload = payload; // аллоцировали, положили - довольные
      delete p['payload_info'];

      // F-RESTORE-OBJECT
      if (p.single_payload) return p.payload[0]      
      
      return p;
  }

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
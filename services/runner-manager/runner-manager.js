#!/usr/bin/env -S node

// tood раннер должен выбирать такую задачу чтобы заюзать побольше нидсов своих
/*
  получается у нас task_label заодно играет роль идентификатора раннера
*/

import * as PPK from "ppk"

PPK.prefix_console_log( () => ["[runner-manager]",performance.now()] )

console.log("try connecting to mozg",process.env.MOZG_URL || '(default url)')
PPK.connect( "runner-manager",process.env.MOZG_URL, process.env.VERBOSE_MSG, process.env.PUSHA_URL ).then( rapi => {
  console.log("connected")

  let verbose = process.env.VERBOSE
  let solver = new Solver( rapi,verbose )

  // F -RUNNERS-LIST
  // todo перейти на мониторинг список - это будет эффективнее
  // todo посылать больше информации.. сейчас ток названия
  // хотя опять же runner-info можно читать.
  // но в целом эффективнее список. и кстати т.о. можно раздавать 
  // не только функции а и значения вообще - это будет удобно
  //function broadcast_runners() {    
    //return rapi.msg({label:"runners-list",list:solver.runners.keys()})  
  //}

  rapi.query( 'exec-request-ready' ).done( msg => {
    if (verbose)
      console.log('got exec-request-ready',msg)

    //// необходимо сконвертировать запрос. добавить ниды на пейлоады
    // но получается эта обработка проводится только для аргументов задачи, без аргументов нидов
    // это даже полезно для skip_payloads
    for (let argname in msg.arg) {
      let val = msg.arg[argname]
      if (val == null) continue
    
      // блок данных с пейлоадами
      // вопрос а зачем этим занимается менеджер? ну или просто удобно было тут..
      // типа чтобы всем клиентам не добавлять?
      if (val.payload_info) {
         //console.log("VAL PAYLOAD. PATCHING",val)
         
         // идентификатор для "ниды" выражающей загрузку данных
         let url_sum = val.payload_info.map( x => x.url )
         let p_id = val.id || `payload:${msg.lang_env}:${url_sum}` // F-KEEP-TASK-ID
         // F-PAYLOAD-BYTES-COUNT
         let bytes_sum = val.payload_info.reduce((a, b) => a.bytes_count + b.bytes_count, {bytes_count:0}) 
         let limits = {ram: bytes_sum}
         // todo тут не совсем get_payload, т.к. в val может быть нечто бОльшее..
         val = {need: true, code: "restore-object", arg: val, id: p_id, limits }
         msg.arg[argname] = val
      } // непосредственно пейлоад
      else if (val.url && val.bytes_count) {
        // пейлоада в чистом виде, одна штука..
        let p_id = val.id || `payload:${msg.lang_env}:${val.url}` // F-KEEP-TASK-ID
        let limits = {ram: val.bytes_count}
        val = {need: true, code: "get-payload", arg: {payload_info:val}, id: p_id, limits }
        msg.arg[argname] = val
      }
    }

    /// передаем решателю. он уже будет учитывать

    solver.add_request( msg.id, msg )
  })

  // F-RUNNERS-LIST
  // это получается центральный сервер сообщает
  // но теоретически и клиент мог бы вести список раннеров сам, получая runner-info
  // но тогда ему придется и отслеживать когда они уходят
  /*
  rapi.query( 'get-runners' ).done( msg => {
     rapi.reply( msg, solver.runners.keys() ) 
  })
  */
  // решил попробую пусть менеджер широковещает список раннеров при их подключении отключении

  rapi.query( 'runner-info' ).done( msg => {
    //if (verbose)
      console.log('got runner-info',msg)
    solver.add_runner_info(  msg.task_label, msg )

    //broadcast_runners()  // todo надо проверять что он новое

    rapi.get_list( msg.task_label ).then( list => {
      //console.log('got list, setting ondelete',msg.task_label)
        list.deleted.subscribe((opts) => {
          let reaction_id = opts.name
          let reaction_body = opts.value
          console.log('ondelete called',{reaction_id,reaction_body})
          if (reaction_body.arg.value == msg.task_label) { 
            console.log("match. detaching runner",reaction_body.arg.value)
            // признак раннера - т.е. удаляется его query.. 
            //  но что если его квери удаляется по внутренней ошибке?
            solver.runner_detached( reaction_body.arg.value )
            //broadcast_runners()
          }
        })
    })
  })
  /* вроде ети не нужны
  rapi.query( 'runner-finished' ).done( msg => {
    if (verbose)
      console.log('got runner-finished',msg)
    solver.runner_finished(  msg.runner_id, msg.id, msg )
  })

  rapi.query( 'set-env' ).done( msg => {
    console.error("set env is prohibited!",msg)
    if (verbose)
      console.log('got set-env',msg)
    solver.set_env( msg.id, msg.value )    
  })
  */

})

/*
 точки входа (API)
 add_request
 add_runner_info
 runner_finished
 runner_detached
 set_env
*/

//import {Solver} from "./solver5.js"
import {Solver} from "./solver6.js"

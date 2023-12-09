#!/usr/bin/env node

/* сервис промис

   todo
     create_promises(N) -> [...N promises...]
     - работа с идентификаторами: резолв по идентификатору, например. с авто-созщданием промисы/
     - ожидание по идентификатору даже не созданной промисы - разрешить.
     - но в целом надо уже двигаться к таскам и с ними увязывать.
   
   идея - удобно было бы query на методы класса положить ))))
   идея - мб пусть по айдишникам всегда все работает на вход, и не надо hdl передавать. а может и на выход.
          а там в клиентское апи уже обернуть.
*/

import * as PPK from "../../client-api/client-api.js"
import req_init from "../../client-api/req.js"

PPK.prefix_console_log( () => ["[promises-srv]"] )

PPK.connect("promises-srv")
.then( rapi => {
  let req_api = req_init( rapi, rapi.query )
  rapi.request = req_api.request.bind( req_api )
  rapi.reply = req_api.reply.bind( req_api )
  return rapi
})
.then(rapi => {
  console.log("connected")

  let promises = new Map()

  /* 
   опции: 
     id - идентификатор промисы, необязательно (если указать то ок, если не указать то сгенерируется)
          если уже есть промиса с таким id, то ошибка
  */
  let promises_id_counter = 0

  function create_promise() {
      // будем использвать js промисы внутри, так удобно
      let p_resolve, p_reject
      let p = new Promise( (resolve, reject) => {
        p_resolve = resolve
        p_reject = reject
      })
      p.p_promise = true      
      p.resolve = (value) => {
            p.resolved = true
            p_resolve(value)
        }
      p.reject = p_reject
      return p
  }

  function create_and_register_promise( id ) {
        let p = create_promise()
        id ||= `promise_${promises_id_counter++}`
        p.id = id
        promises[id] = p
        return p
  }

  function find_or_create_promise( id ) {
    if (!id) {
      console.error("find_or_create_promise: id must be specified")
      return
    }
    let existing = promises[id]
    if (existing) return existing
    return create_and_register_promise( id )
  }

  //// api

  // msg.hdl - входная промиса
  // msg.value - значение
  // возврат: ошибка или промиса
  rapi.query( "resolve-promise" ).done( (msg) => {
    //console.log("resolve-promise called",msg)
    let p = find_or_create_promise( msg.hdl.id )
    if (!p) 
      return rapi.reply( msg, { error: true, id:msg?.hdl?.id || 'null', msg: "cannot find or create promise with this id" } )
    if (p.resolved)
      return rapi.reply( msg, { error: true, id:msg?.hdl?.id || 'null', msg: "promise with this id already resolved" } ) 
    if (msg.payload_info)    
    {
      // значение пришло в payload_info
      p.resolve( {payload_info: msg.payload_info} )
    }
    else
      p.resolve( msg.value )
    
    rapi.reply( msg, p )
  })

  // ждать промису
  // msg.hdl - входная промиса
  // возврат: значение промисы

  rapi.query( "wait-promise" ).done( (msg) => {
    let p = find_or_create_promise( msg.hdl.id )
    if (!p) 
      return rapi.reply( msg, { error: true, id:msg?.hdl?.id, msg: "cannot find or create promise with this id" } )    
    p.then( (value) => {
      rapi.reply( msg, value )
    })
  })

  // организует так, что целевая промиса резолвится когда все промисы из списка резолвятя
  // msg.hdl - целевая промиса
  // msg.input - массив входных промисов

  rapi.query( "when-all" ).done( (msg) => {
    let p = find_or_create_promise( msg.hdl.id )
    let arr = msg.input.map( x => find_or_create_promise( x.id ) )

    Promise.all( arr ).then( (values_arr) => {
      p.resolve( values_arr )
    })

    rapi.reply( msg, true )
  })

  // делает как when-all но только если хотя бы 1 промиса из списка разрезолвится
  // msg.hdl - целевая промиса
  // msg.input - массив входных промисов  
  rapi.query( "when-any" ).done( (msg) => {
    let p = find_or_create_promise( msg.hdl.id )
    let arr = msg.input.map( x => find_or_create_promise( x.id ) )

    Promise.any( arr ).then( (value) => {
      p.resolve( value )
    })

    rapi.reply( msg, true )
  })  

})


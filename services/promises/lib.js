// F-PROMISES-CHANNELS

const verbose_level_2 = false;

export function promises_service_logic( rapi, channel="" ) {
  //console.log("connected")

  //// api
  let pr = new PromisesService( rapi )
  let verbose = process.env.VERBOSE ? true : false
  
  // msg.hdl - входная промиса
  // msg.value - значение
  // возврат: ошибка или промиса
  rapi.query( `${channel}resolve-promise` ).done( (msg) => {
    msg.hdl ||= msg.promise // совместимость 
    if (verbose_level_2)
        console.log("resolve-promise called",msg.promise.id)
    let p = pr.find_or_create_promise( msg.hdl.id )
    if (!p && msg.reply_msg) 
      return rapi.reply( msg, { error: true, id:msg?.hdl?.id || 'null', msg: "cannot find or create promise with this id" } )
    if (p.resolved && msg.reply_msg)
      return rapi.reply( msg, { error: true, id:msg?.hdl?.id || 'null', msg: "promise with this id already resolved" } ) 
    if (msg.payload_info)
    {
      // значение пришло в payload_info
      p.resolve( {payload_info: msg.payload_info} )
    }
    else
      p.resolve( msg.value )

    // ну как бы а зачем мы отвечаем.. там же даже не читают..
    if (msg.reply_msg) rapi.reply( msg, p )
  })

  // ждать промису
  // msg.hdl - входная промиса
  // возврат: значение промисы

  rapi.query( `${channel}wait-promise` ).done( (msg) => {
    msg.hdl ||= msg.promise
    //console.log("wait-promise. msg=",msg,"gonna wait",msg.hdl.id)
    if (verbose_level_2)
       console.log("wait-promise. id=",msg.promise.id)
    let p = pr.find_or_create_promise( msg.hdl.id )
    if (!p) 
      return rapi.reply( msg, { error: true, id:msg?.promise?.id, msg: "cannot find or create promise with this id" } )
    p.then( (value) => {
      if (verbose_level_2)
          console.log("wait-done - sending reply. id=",msg.promise.id)
      rapi.reply( msg, value )
    }).catch( err => { // не смогла вычислить / ошибка вычисления
      rapi.reply( msg, { p_error: true, error: err} )
    })
  })

  // организует так, что целевая промиса резолвится когда все промисы из списка резолвятя
  // msg.hdl - целевая промиса
  // msg.input - массив входных промисов

  rapi.query( `${channel}when-all` ).done( (msg) => {
    msg.hdl ||= msg.promise
    msg.input ||= msg.list
    let p = pr.find_or_create_promise( msg.hdl.id )
    let arr = msg.input.map( x => pr.find_or_create_promise( x.id ) )

    Promise.all( arr ).then( (values_arr) => {
      p.resolve( values_arr )
    }).catch( error => {
      p.reject( error )
    })

    if (msg.reply_msg)
        rapi.reply( msg, true )
  })

rapi.query( `${channel}when-all-reduce` ).done( (msg) => {
    msg.hdl ||= msg.promise
    msg.input ||= msg.list
    let p = pr.find_or_create_promise( msg.hdl.id )
    let arr = msg.input.map( x => pr.find_or_create_promise( x.id ) )

    Promise.all( arr ).then( (values_arr) => {
      let sum = 0
      for (let i=0; i<values_arr; i++)
        sum += values_arr.average
      p.resolve( sum )
    }).catch( error => {
      p.reject( error )
    })

    if (msg.reply_msg)
        rapi.reply( msg, true )
  })  

  // делает как when-all но только если хотя бы 1 промиса из списка разрезолвится
  // msg.hdl - целевая промиса
  // msg.input - массив входных промисов  
  rapi.query( `${channel}when-any` ).done( (msg) => {
    msg.hdl ||= msg.promise
    msg.input ||= msg.list
    let p = pr.find_or_create_promise( msg.hdl.id )
    let arr = msg.input.map( x => pr.find_or_create_promise( x.id ) )

    Promise.any( arr ).then( (value) => {
      p.resolve( value )
    }).catch( error => {
      p.reject( error )
    })

    if (msg.reply_msg)
       rapi.reply( msg, true )
  })

  ///////////////////////

}

class PromisesService {
  promises = new Map()

  constructor( rapi ) {
  }

  /* 
   опции: 
     id - идентификатор промисы, необязательно (если указать то ок, если не указать то сгенерируется)
          если уже есть промиса с таким id, то ошибка
  */
  promises_id_counter = 0

  // создает промису
  create_promise() {
      // будем использвать js промисы внутри, так удобно
      let p_resolve, p_reject
      let p = new Promise( (resolve, reject) => {
        p_resolve = resolve
        p_reject = reject
      })
      p.p_promise = true      
      p.resolve = (value) => {
            p.resolved = true
            return p_resolve(value)
        }
      p.reject = (err) => {
        p.rejected = true
        console.log("rejecting promise",p.id)
        p.catch( () => {
          console.log("inside promise catch.")
        }) // надо хотя бы 1 раз поймать а то unhandled rejection
        return p_reject(err)
      }

      return p
  }

  // создает промису с указанным идентификатором
  // либо со своим идентификатором
  // и регистрирует её в словаре промис
  create_and_register_promise( id ) {
        let p = this.create_promise()
        id ||= `promise_${this.promises_id_counter++}`
        p.id = id
        this.promises.set(id,p)
        return p
  }

  // находит или создает промису
  find_or_create_promise( id ) {
    if (!id) {
      console.error("find_or_create_promise: id must be specified", id)
      console.log("find_or_create_promise: id must be specified", id)
      console.trace()
      return
    }
    let existing = this.promises.get(id)
    if (existing) return existing
    //console.log("promise not existed, creating",id)
    return this.create_and_register_promise( id )
  }
}
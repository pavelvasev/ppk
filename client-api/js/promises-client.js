// Сервис обещаний. Клиентский интерфейс.

/*
   важно. Функции сервиса возвращают готовый результат. Системные промисы (ппк). (я их называю hdl в текстах)
   а не промисы которые еще резолвить надо.
   это все ради удосбтва. ну а следствие - айди промисам генерировать надо тут же.


*/

// F-PROMISES-CHANNELS
function compute_label( promise, label ) {
    return (promise.channel_id || "") + label
}

export default function init( rapi, query_fn, request_fn ) {

  //return new Promise( (res,rej) => {
/*
    //console.log("pppp1")
    request_fn( {label:"start-on-main",guid:"promise-srv",path:"./services/promises/promises-srv.js"} )
    .done( result => {
       //console.log("pppp1",result)
       res( new PromisesServiceApi( rapi, query_fn, request_fn ) )
    })
  })
*/  
  return new PromisesServiceApi( rapi, query_fn, request_fn )
}

export class PromisesServiceApi {

  constructor( rapi, query_fn, request_fn ) {
    this.query = query_fn // fn или api? (т.е. объект с методом query)
    this.request = request_fn
    this.rapi = rapi
    this.base_guid = this.rapi.generate_uniq_query_id( "promise_client" )
    this.base_guid_counter = 0
  }

  ///////////////////////////////////
  // internal
  mk_guid_fast() {
    //return `${this.base_guid}_${this.base_guid_counter++}`
    // сначала меняющаяся часть - чтобы быстрее словари работали (как они там сделаны?)
    return `${this.base_guid_counter++}_${this.base_guid}`
  }  

  mk_promise( id, channel_id=null ) {
    id ||= this.mk_guid_fast()
    return { p_promise: true, id, channel_id }
  }


  /////////////////////////////////// 
  // api

  // промисы

  // создает 1 промису и возвращает объект промисы
  create_promise( id=null,channel_id=null )
  {
    return this.mk_promise( id, channel_id )
  }

  // создает набор промисов и возрвращает его
  create_promises( n ) {
    let res = []
    for (let i=0; i<n; i++) {
      res.push( this.mk_promise() )
    }
    return res
  }

  // резолвит промису
  // вопрос. value тут реструктированная или нет????
  resolve_promise( hdl, value )
  {
    //console.log("resolve_promise: ",{hdl,value})
    if (value?.then) // если на вход дали обычную промису - отправим ее результат
    {
      return value.then( p_value => {
        //console.log("resolve_promise: value resolved to",{value,p_value})
        return this.resolve_promise( hdl,p_value )
      })
    }
    else {
      // todo вставить сюда обезжиривание и пусть им все пользуются
      // либо вынести в отдельную функцию.. F-UNFAT-OBJECT

      // гиперпрямой вызов
      let l = this.locally_waiting_promises.get( hdl.id )
      if (l) {
         //console.log("HYPER-RESOLVE",hdl.id)
         l( value )
      }

      // прямой резолв
      let msg0 = {label: hdl.id ,value}
      // this.rapi.msg(msg0)
      // вопрос а зачем нам resp вообще. чего туда сюда данные гонять?
      // а ну код ошибки получить.. ну ок пока..
      let msg = {label:compute_label(hdl,"resolve-promise"),promise:hdl,value}
      //return this.request(msg).resp

      // вот это оптимизация. мол нас ответы не интересуют. хотя конечно же в случае ошибки
      // было бы интересно такой ответ получить.
      this.rapi.msg( msg )
    }
  }

  locally_waiting_promises = new Map() // F-LOCAL-GLOBAL-PROMISES



  // устраивает ожидание глобальной промисы в локальном потоке (с помощью локальной промисы)
  wait_promise( hdl )
  {
    //console.error("wait-promise begin",hdl)
    //console.trace()

    let do_resolve, do_reject
    let result = new Promise( (resolve,reject) => {
      do_resolve = resolve
      do_reject = reject
    })

    this.locally_waiting_promises.set( hdl.id,(value) => {
      //console.log("wait-promise resolved from HYPER-RESOLVE", hdl.id )
      do_resolve( value )
    } )
    result.then( () => this.locally_waiting_promises.delete( hdl.id ) )

    let p0, p1, pp0

    // опрос напрямую
    /*
    pp0 = this.rapi.query( hdl.id,{N:1} ).done( (msg) => {
      console.log("wait-promise resolved from direct message", hdl.id)
      do_resolve( msg.value )
    } )
    */

    // ну такая форма корзинки.. todo видимо применить стандартную. или эту выпрямить.
    p1 = this.request({label:compute_label(hdl,"wait-promise"),"promise":hdl}).resp

    p1.then( (value) => {
      //console.log("wait-promise resolved from promisa-server! promise_id=", hdl.id)
      //pp0.then( x => {
        //console.error("pp0 resolves to",x,"pp0=",pp0)
        //x.delete()
      //} ) // отзываем прямой запрос
      do_resolve( value )
    })

    return result
/*
    p0 = new Promise( (resolve,reject) => {
      pp0 = this.query( hdl.id,{N:1} ).done( resolve )
    })
    p1 = this.request({label:"wait-promise",hdl}).resp
    let any = Promise.any( [p0,p1] )
    any.then( () => {
      pp0.delete()
    })
    return any
*/    
  }

  // возвращает глобальную промису которая будет разрезолвлена 
  // когда все промисы из array_of_hdl разрезолвятся
  // вообще говоря не обязательно посылать список айди на сервер а можно
  // таскать эти id за собою.
  when_all( array_of_hdl ) {
    let hdl = this.mk_promise()
    this.request({label:compute_label( array_of_hdl[0], "when-all" ),promise:hdl,list:array_of_hdl})
    return hdl
  }

  when_any( array_of_hdl ) {
    let hdl = this.mk_promise()
    this.request({label:compute_label( array_of_hdl[0], "when-any" ),promise:hdl,list:array_of_hdl})
    return hdl
  }

  // ожидание всех промис
  // а чем это по сути отличается от when-all?
  // ну кроме того что мы всех по отдельности запрашиваем..
  // что нам на руку сейчас будет - сервера обещаний разные
  wait_all( pr_arr ) {
    return Promise.all( pr_arr.map( x => this.wait_promise(x)) )
  }

  to_local_promise( promise ) {
    let q = {}
    q.then = (cb) => {
      return this.wait_promise( promise ).then( cb )
    }
    return q
  }

  /////////// собственно новое апи

  // добавить данные
  /* варианты data
      - typedarray
      - объект с полем payload
      - что угодно другое что сериализуется в json

     результат - обещание  
  */
  add_data( data ) {
    //console.log("add_data",{data})
    let p = this.create_promise()

    // todo это переехать должно по смыслу в resolve-promise F-UNFAT-OBJECT
    if (data.buffer)
    this.rapi.submit_payload( [data] ).then( (submitted) => {
        return this.resolve_promise( p, {"single_payload": true, "payload_info":submitted} )
    })
    else
      if (data.payload) 
      this.rapi.submit_payload( data.payload ).then( (submitted) => {
        let new_data = {...data,payload_info: submitted}
        delete new_data['payload']
        return this.resolve_promise( p, new_data )
      })
    else  
      this.resolve_promise( p, data )

    //this.resolve_promise( p, data )
    
    return p
  }

  // вход - обещание
  // выход - развернутый в памяти объект
  // todo: здесь можно добавить и обработку канала/значения канала.
  get_data( hdl ) {
    return this.wait_promise( hdl ).then( result => {
      if (result.url && result.bytes_count)
        return this.rapi.get_payload( result )
      if (result.single_payload)
        return this.rapi.get_payload( result.payload_info[0] )
      if (result.payload_info) {
        return this.rapi.get_payload( result.payload_info ).then( data => {
          result.payload = data
          return result
        })
      }
      return result
    })
  }

}
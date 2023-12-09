// Сервис обещаний. Клиентский интерфейс.

/*
   важно. Функции сервиса возвращают готовый результат. Системные промисы (ппк). (я их называю hdl в текстах)
   а не промисы которые еще резолвить надо.
   это все ради удосбтва. ну а следствие - айди промисам генерировать надо тут же.
*/

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

  // internal
  mk_guid_fast() {
    return `${this.base_guid}_${this.base_guid_counter++}`
  }  

  mk_promise( id ) {
    id ||= this.mk_guid_fast()
    return { p_promise: true, id }
  }
  /// api

  // промисы

  // создает 1 промису и возвращает объект промисы
  create_promise( id=null )
  {
    return this.mk_promise( id )
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
      let msg = {label:"resolve-promise",hdl,value}
      return this.request(msg).resp
    }
  }

  // устраивает ожидание глобальной промисы в локальном потоке (с помощью локальной промисы)
  wait_promise( hdl ) 
  {
    return this.request({label:"wait-promise",hdl}).resp
  }

  // возвращает глобальную промису которая будет разрезолвлена 
  // когда все промисы из array_of_hdl разрезолвятся
  // вообще говоря не обязательно посылать список айди на сервер а можно
  // таскать эти id за собою.
  when_all( array_of_hdl ) {
    let hdl = this.mk_promise()
    this.request({label:"when-all",hdl,input:array_of_hdl})
    return hdl
  }

  when_any( array_of_hdl ) {
    let hdl = this.mk_promise()
    this.request({label:"when-any",hdl,input:array_of_hdl})
    return hdl
  }

  /////////// собственно новое апи

  // добавить данные
  /* варианты data
      - typedarray
      - массив из typedarray
      - что угодно другое что сериализуется в json
  */
  add_data( data ) {
    //console.log("add_data",{data})
    let p = this.create_promise()
    this.resolve_promise( p, data )
    return p
  }

}
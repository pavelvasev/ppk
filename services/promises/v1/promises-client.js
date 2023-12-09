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
  }

  // возвращает hdl объект промисы
  // асинхронное создание промисов это смешное...
  create_promise( id=null )
  {
    id ||= this.rapi.generate_uniq_query_id( "create_promise" )
    let resp = this.request({label:"create-promise",id}).resp
    let res = {
      p_promise: true,
      id
    }
    return res
  }

  create_promises( n ) {
    return this.request({label:"create-promises-n",n}).resp 
  }

  resolve_promise( hdl, value ) 
  {
    return this.request({label:"resolve-promise",hdl,value}).resp
  }

  wait_promise( hdl ) 
  {
    return this.request({label:"wait-promise",hdl}).resp
  }

  when_all( array_of_hdl ) {
    return this.request({label:"when-all",input:array_of_hdl}).resp 
  }

}
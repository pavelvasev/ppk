// Сервис запросов. 
// Но это уже других запросов не которые query. Query назовем сервисом поиска.
// request, reply - клиентские апи

/* 
  возвращаемое значение - произвольное сделано. не обязательно msg. но если надо передавать пейлоады то 
  вписывать поле .payload и далее оно обработается как .msg - в payload_info превращарется

  мб - сделать then а не done. посмотреть после апи построения графа задач.
    но - что если несколько отвечают? тогда then как-то странно смотрится..

  мб - так-то неудобно писать request(msg) а мб традиционнее request( label, ...args) ?
*/

export default function init( rapi, query_fn ) {
  //return Promise.resolve( new RequestServiceApi( rapi, query_fn ) )
  return new RequestServiceApi( rapi, query_fn )
}

export class RequestServiceApi {

  constructor( rapi, query_fn ) {
    this.query = query_fn // fn или api? (т.е. объект с методом query)
    this.rapi = rapi    
  }

  //////////// request
  request_query_for_results = null
  request_result_label = null
  request_cb_table = {}

  request_id_counter = 0
  request(msg) {
    //let id = this.rapi.generate_uniq_query_id('request');
    // дизайн - request локальная вещь. сообразно ее можно сделать покороче при передаче
    // из идей - запаковать в строку или хотя бы hex.
    let id = this.request_id_counter++

    // размещаем query 1 раз на все exec-запросы от этого клиента
    // F-EXEC-QUERY-ONE
    // получается мы query всегда делаем.. но так-то можно и без этого.. ну ладно..
    this.request_result_label ||= this.rapi.generate_uniq_query_id('req-results');;
      // ну типа.. метку используем одну и ту же для разных - ну хорошо.
    if (!this.request_query_for_results) {
        this.request_query_for_results = this.query(
              this.request_result_label, // F-CRIT-IS-LABEL
              { prefix: 'request_q_result', sender: 'request' } // можно добавить permanent но кому это надо если процесс завершится?
              ).done( msg => {                  
                  let cb = this.request_cb_table[ msg.request_id ]
                  if (!cb) {
                    //console.error("exec done code is not assigned!",msg.exec_id)
                    // так вроде ну и что. ну решили не указывать.
                  }
                  else {
                    
                    if (msg.payload_info) msg.result.payload_info = msg.payload_info
                    cb( msg.result )
                    // но вот идея пейлоады вообще сосоедними аргументами посадить
                    // т.е. cb( msg.result, msg.payload_info) или даже
                    // cb( msg.result, ...msg.payload_info)
                    
                    //cb( msg )
                  }
              } )
    }
    // фишка - надо в обратку указывать не только метку но и id запроса.
    // а то мы на метках погорим - нельзя их слишком много, дорого
    msg.reply_msg ||= { label: this.request_result_label, request_id: id };

    let res = Promise.resolve( this.request_query_for_results ).then( (r) => {
      //console.log("req sending msg:",msg)
      return this.rapi.msg( msg ) } )

    //let res = { msg_req: res1 }

    // указывая done, пользователь указыает что его интересует результат
    // но он может и не указывать done. поэтому мы всегда делаем подписку на результат - см выше.
    // у пользователя остается возможность сделать пустое result_msg и т.о. отказаться от посылки результата

    // ну вот почему done a не then.
    // сейчас then это значит отправлено. но в прикладном смысле ценнее then - ответ уже.
    // а отправлено.. ну можно другое что-то. например res.sent.then
    res.done = (user_action_fn) => {
        // console.log("this.request_cb_table=",this.request_cb_table)
        this.request_cb_table[ id ] = (msg) => {          
          delete this.request_cb_table[ id ] // странно.. зачем удалять
          return user_action_fn( msg )
        }
        return res
    }
    res.resp = { then: res.done } // resp = имитатор ответа в стиле then-able 
    
    res.id = id

    return res;
  }

  // reply( inmsg, reply_msg )
  // криво конечно что данные идут в reply_msg.payload
  // а при этом хорошо бы - уметь и attached-payload обработать
  // а мы получается этого не можем..
  // а все потому что у нас в ответ не только label но и request_id идет.
  // ну или мы можем слить просто 2 месседжа в одно и тогда все норм будет
  
  reply( request_msg, result_data ) {
    //if (!request_msg.reply_msg)
    //  return

    let reply = {...request_msg.reply_msg, result:result_data }
    if (result_data?.payload) {
      reply.payload = result_data.payload
      delete result_data['payload']
    }
    return this.rapi.msg( reply )
  }
  
/*
  // в общем не знаю как лучше, надо погонять. этот вариант короче по реализации
  // но ответ тогда это обязательно сообщение. что как бы минус тоже.
  reply( request_msg, result_data ) {
    let reply = {...request_msg.reply_msg,...result_msg }
    return this.msg( reply )
  }
*/  

}
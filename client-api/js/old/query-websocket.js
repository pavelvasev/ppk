/* websocket
*/

export default function init( rapi ) {

  // вот странное. тут мы вводим патч. а далее - не вводим.
  let orig_exit = rapi.exit.bind(rapi)
  rapi.exit = () => {
    if (incoming_msg_server) {
      // но получается если он не открылся то мы и исидим тут сидим.. ну и ладно
      incoming_msg_server.then( info => {
        console.log("client-api: closing websocket query server" );//,info.server)
        info.server.close()
        incoming_msg_server = null
      })
    }
    return orig_exit()
  }

  /// теперь надо квери
  // а для него - http-сервер. радует что это мы сами себе сервер делаем, можем поменять на другое если надо
  // возвращает объект с методом .code там указывается каллбека получения сообщений
  // и затем code возвращает промису, которая резолвится когда запрос размещен в мейне (но еще не факт что дошел до получателей)

  let process_incoming_message = (msg) => {
      //console.log("query: some message arrived",msg)
      let q = query_cb_dic.get( msg.query_id )
      if (!q) {
        console.log('incoming msg label doesnt match to any query',{query_cb_dic})
        return
      }
      let f = q.fn
      if (!f) console.error('incoming msg label doesnt match to any query')
        else {
          // F-QUERY-N
          //console.log('hehe,',q)
          if (q.N) {
            if (q.counter <= 0) return; // закончилось наше N
            q.counter--
            if (q.counter == 0) { // надо отозвать реакцию
              //console.log("deployed_reaction_promise=",deployed_reaction_promise)
              //console.log("deactivating reaction",q.rp)
              q.rp.delete() // отзываем
              query_cb_dic.delete( msg.query_id )
            }
          }
          //f( msg.m, arg )
          f( msg.m )
        }
    }

  let incoming_msg_server = null
  let query_cb_dic = new Map()
  let query = ( crit, opts={}, arg ) => 
  {
    if (arg) {
      console.error("QUERY ARG IS",arg)
      console.trace()
    }
    let query_id = rapi.generate_uniq_query_id( opts.prefix || "query" )

    let counter = opts.N
  

    incoming_msg_server ||= start_message_server( process_incoming_message ) // start_message_server


    let result = {
      action: (fn,arg) => {
        opts.q_action = fn
        opts.q_arg = arg
        //console.log("!!!!!!!!!!!!1 opts.q_action=",opts.q_action)
        return result
      },
      done_2: (fn) => { 
        // todo если надо будет. идея - что вызываем следующий done только
        // на резлове промисы..
        // todo idea вообще сделать цепочку этих done. чтобы можно было несколько и можно было done_2 вперемешку.
        let queue = []
        let queue_fn = ( msg ) => {
        }
        return result.done( queue_fn )
      },
      done: (fn) => {
        query_cb_dic.set( query_id, {fn, N: opts.N, counter: opts.N} )
        return Promise.resolve(incoming_msg_server).then( (srv_info) => {

          // фактическое размещение реакции с запросом

          let rarg = {results_url: srv_info.my_endpoint_url,
                      query_id, actor_id: rapi.actor_id,
                      value: opts.value, // F-QUERY-CUSTOM-VALUE
                      q_action:(opts.q_action || '').toString(),
                      q_arg: (opts.q_arg || {})}
          //console.log('setting reaction with rarg',rarg)
          // мб переделать query_id перенести в урль, а там - ну что прислали то и давать, не смешивать в query

          // где-то тут я перегнул палку. видимо передавая аргументы в операцию..
          let deployed_reaction_promise = rapi.reaction( crit, opts ).action( rapi.operation( "do_query_send", rarg ),{value:opts.value} )
          // reaction action defined

          query_cb_dic.get( query_id ).rp = deployed_reaction_promise          
          // типа возвращаем промису посылки сообщения. хм.
          return deployed_reaction_promise
        }) // promis

      }
    }
    // итого указав код, мы получим промису которая разрезолвится когда наш сервер будет готов
    // и будет разослана реакция запроса в центр (но еще не факт что дошла до получателей....)

    return result
  }

  let do_query_send = (msg,rarg) => {
            if (rarg.q_action) {
              if (!rarg.q_action.bind) rarg.q_action = eval( rarg.q_action )
              msg = rarg.q_action( msg, rarg.q_arg ) 
            }
            // загрузим нагрузку отдельно.. но конечно вопрос, а надо ли это теперь.
            // F-PUSHA-MSG-SUBMIT
            let payload = []
            // F-UNFAT-OBJECT
            if (msg.payload) {
               // проблема что query-запросов может быть несколько и им надо разделять состояние
               // по отправке сообщения.. а единственный способ это сделать это вроде как получается
               // записать информацию в само сообщение
               // todo idea: писать сразу в msg.payload_info и внизу resolve от него..
               // ну будет у сообщений без пейлоада пустое payload_info - можно пережить
               msg.payload_submit_process ||= rapi.submit_payload( msg.payload ).then( (payload_info_array) => {
                  if (payload_info_array.length > 0) {
                    // строим новое сообщение - уже с пейлоадом
                    let new_msg = {...msg}
                    delete new_msg['payload']
                    delete new_msg['payload_submit_process'] // важно! это мы убрали из нового сообщения
                    new_msg.payload_info = payload_info_array 
                    return new_msg
                  }
                  return msg
                })
            } else {
              // поля payload нет и не было
              let new_msg = {...msg}
              delete new_msg['payload_submit_process'] // убрали в новом сообщении
              msg.payload_submit_process = Promise.resolve(new_msg)
            }

            msg.payload_submit_process.then( msg_with_payload_info => {

              // итак мы на клиенте и у нас есть msg
              // считаем что на клиенте есть глобальный метод fetch
              // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
              let packet = {query_id:rarg.query_id, m:msg_with_payload_info}

              // F-DIRECT
              if (rapi.actor_id && rapi.actor_id == rarg.actor_id) {
                // о так это ж мы сами
                // console.log("ok direct submit",rapi.actor_id)
                return rapi.submit_direct_query_reply( packet )
              }

              if (rapi.verbose)
                  console.log('query: sending msg to',rarg.results_url, 'rarg=',rarg,'packet=',packet)

              return fetch_packet( rarg.results_url, packet ).then( res => {
                  if (rapi.verbose)
                     console.log('query: msg label',msg.label,'to',rarg.results_url, 'is sent')
                  } ).catch( err => {
                     console.log('query: query sending msg fetch error',err,msg)
                     console.error('query: query sending msg fetch error',err,msg)
                  } )
            })
          }  

  return {query, do_query_send, submit_direct_query_reply:process_incoming_message}
}

/////////////////////////////////////////

import WebSocket from 'ws';
import { WebSocketServer } from 'ws';

let clients = new Map()

function fetch_packet( target_url, msg ) {

  let client = clients.get( target_url )
  if (!client) {
    client = new WebSocket( target_url,
      { perMessageDeflate: false,
        skipUTF8Validation: true,
        maxPayload: 1024*100,
        handshakeTimeout: 5000
      } );
    clients.set( target_url,client )

    client.opened = create_promise()
    client.on('open', () => {
      client.opened.resolve()
    });
    client.on('error', console.error);
  }

  let str = JSON.stringify(msg)

  return client.opened.then( () => client.send( str ))
}

function create_promise() {
  let a,b
  let p = new Promise( (resolve, reject) => {
    a = resolve
    b = reject
  })
  p.resolve = a
  p.reject = b
  return p
}


////////////////////////////////////////////


function start_message_server( message_arrived,port=11000,host='0.0.0.0',allow_find_free_port=true) {

   let wss = new WebSocketServer({
      host: "0.0.0.0",
      port: port,
      perMessageDeflate: false,
      skipUTF8Validation: true,
      maxPayload: 200*1024*1024
    })
    // https://github.com/websockets/ws/blob/HEAD/doc/ws.md#websocketbinarytype

    wss.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        if (allow_find_free_port) {
          //console.log('Address in use, retrying...');
          port = port+1;
          wss._server.listen( port,host );
        }
        else {
          throw e
        }
      }
    });
    
    wss.on('connection', (ws) => on_client_connection( wss, ws ) );

    function on_client_connection( wss, ws, verbose ) 
    {
      ws.on('message', (data) => {
        let msg = JSON.parse( data )
        message_arrived( msg )
      })
    }
    
    //wss.on('message', (msg) => process_incoming( msg, ws ) )

    return new Promise( (resolve, reject) => {

      wss.on("listening",() => {
        console.log('incoming websocket query server started at:', wss.address());
        //console.log('http server started: http://%s:%s', server.address().address, server.address().port);
        //server.address().address
        let adr = process.env['PPK_PUBLIC_ADDR'] || '127.0.0.1'
        let my_endpoint_url = `ws://${adr}:${wss.address().port}/`
        //let my_endpoint_url = {host:adr, port: server.address().port }
        console.log({my_endpoint_url})
        resolve( {server:wss,my_endpoint_url} )
      });

    })    

    function process_incoming( data,ws ) {
      //console.log(rcounter++,": websocket incoming message of len",msg.length)

      //let data = msg.toString("utf-8")
      let d = {}
      if (data.length > 0)
        try {
          d = JSON.parse( data ); // короче там сообщения у нас мелкие в основном.. может и не надо нам потоковый парсинг
          //console.log("incoming message data=",typeof(data),data.length)
        } catch (err) {
          console.warn("websocket query server: request json parse error", err.message)
          console.warn("incoming message data=",data)
          return
          //return ws.close()
        }
        //d.sender = `${d.sender || ''}/${req.socket.remoteAddress;rinfo.address}/${rinfo.port}`
        message_arrived( d )
    }

}

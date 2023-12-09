/* выводы такие
   - супербыстро, да
   - из 1000 заданий принялось ток 93..

   посылать повторно? таймеры и т.п... отслеживать, пересобирать, fallback на http..

   думаю так: попробую tcp а затем уйду вообще на ucx..
*/

export default function init( rapi ) {

  // вот странное. тут мы вводим патч. а далее - не вводим.
  let orig_exit = rapi.exit.bind(rapi)
  rapi.exit = () => {
    if (incoming_msg_server) {
      // но получается если он не открылся то мы и исидим тут сидим.. ну и ладно
      incoming_msg_server.then( info => {
        console.log("client-api: closing udp server" );//,info.server)
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
      let q = query_cb_dic[ msg.query_id ]
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
            }
          }
          //f( msg.m, arg )
          f( msg.m )
        }
    }

  let incoming_msg_server = null
  let query_cb_dic = {}
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
        query_cb_dic[ query_id ] = {fn, N: opts.N, counter: opts.N}
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

          query_cb_dic[ query_id ].rp = deployed_reaction_promise          
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

              return fetch_udp( rarg.results_url, packet ).then( res => {
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

import dgram from 'node:dgram';
let client = dgram.createSocket('udp4');
let ucounter = 0, rcounter = 0
function fetch_udp( target_url, msg ) {
  let str = JSON.stringify(msg)
  let buf = Buffer.from(str)
  let k = create_promise()
  if (buf.length > 64000)
    return k.reject( `message is too big: len=${buf.length}`)

  console.log(`${ucounter++}: sending udp of len=${buf.length} to target_url=${target_url.host}:${target_url.port}`)
  client.send( buf, 0, buf.length, target_url.port, target_url.host, (err) => {
    if (err) {
      console.error("udp send error",err)
      k.reject( err )
    }
    k.resolve()
  })
  return k
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
//  function start_message_server( message_arrived,port=11000,host='127.0.0.1',allow_find_free_port=true) {
    const server = dgram.createSocket('udp4');

    //httpClose({ timeout: 2000 }, server)
        
    server.keepAliveTimeout = 60*1000*30 // сдался.. 30 минут таймаут ставлю кипалайва.. потому что note-fetch отваливается.. не помогает ему мой патч..
    
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        if (allow_find_free_port) {
          //console.log('Address in use, retrying...');
          port = port+1;
          server.bind( port,host );
        }
        else {
          throw e
        }
      }
    });

    server.on('message', process_incoming )

    server.bind( port,host );

    return new Promise( (resolve, reject) => {

      server.on("listening",() => {
        console.log('incoming msg udp server started at:', server.address());
        //console.log('http server started: http://%s:%s', server.address().address, server.address().port);
        //server.address().address
        let adr = process.env['PPK_PUBLIC_ADDR'] || '127.0.0.1'
        //let my_endpoint_url = `http://${adr}:${server.address().port}`
        let my_endpoint_url = {host:adr, port: server.address().port }
        console.log({my_endpoint_url})
        resolve( {server,my_endpoint_url} )
      });

    })    

    function process_incoming( msg, rinfo ) {
      console.log(rcounter++,": udp incoming message of len",msg.length)

      let data = msg.toString("utf-8")
      let d = {}
      if (data.length > 0)
        try {
          d = JSON.parse( data ); // короче там сообщения у нас мелкие в основном.. может и не надо нам потоковый парсинг
          //console.log("incoming message data=",typeof(data),data.length)
        } catch (err) {
          console.warn("request json parse error", err.message)
          console.warn("incoming message data=",data)
          return
        }
        d.sender = `${d.sender || ''}/${rinfo.address}/${rinfo.port}`
        message_arrived( d )
    }

}

////////////////////////////////////////////
/// https://github.com/tellnes/http-close/blob/master/index.js

function debug(msg) { 
  console.log('httpClose: ',msg)
}
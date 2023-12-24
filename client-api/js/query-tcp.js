/* 
*/

import { SocksClient } from 'socks';

export default function init( rapi ) {

  // вот странное. тут мы вводим патч. а далее - не вводим.
  let orig_exit = rapi.exit.bind(rapi)
  rapi.exit = () => {
    if (incoming_msg_server) {
      // но получается если он не открылся то мы и исидим тут сидим.. ну и ладно
      incoming_msg_server.then( info => {
        console.log("client-api: closing tcp server" );//,info.server)
        info.server.on('close',() => {
          console.log("now server really closed",{client_id:rapi.client_id})
        })
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

  let process_incoming_message = (query_id, msg) => {
      //console.log("query: some message arrived","query_id=",query_id,"msg=",msg)
      let q = query_cb_dic.get( query_id )
      if (!q) {
        console.log('incoming msg label doesnt match to any query',{msg_query_id:query_id,type:typeof(query_id),query_cb_dic,client_id:rapi.client_id})
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
          // попытка ввести промисов.
          //Promise.resolve(true).then( () => f(msg))
          f( msg )
        }
    }

  let incoming_msg_server = null
  let query_cb_dic = new Map()
  let query_counter = 0;
  let query = ( crit, opts={}, arg ) => 
  {
    if (arg) {
      console.error("QUERY ARG IS",arg)
      console.trace()
    }
    let query_id = query_counter ++ ; //rapi.generate_uniq_query_id( opts.prefix || "query" )
    if (console.verbose)
        console.verbose("query-tcp: created query-id for crit",{crit,query_id,client_id:rapi.client_id})

    let counter = opts.N
  

    incoming_msg_server ||= start_message_server( rapi.client_id, process_incoming_message ) // start_message_server
    
    let result = {
      action: (fn,arg) => { // странно и неудобно. надо чтобы query.. action было.
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
      delete: () => {
        //console.log("query-tcp: deleting query-id for crit",{crit,query_id,client_id:rapi.client_id})
        query_cb_dic.get( query_id ).rp.delete()
        query_cb_dic.delete( query_id )
      },
      done: (fn) => {
        query_cb_dic.set( query_id , {fn, N: opts.N, counter: opts.N} )
        let r1 = Promise.resolve(incoming_msg_server)
        return r1.then( (srv_info) => {

          // фактическое размещение реакции с запросом

          let rarg = {results_url: srv_info.my_endpoint_url,
                      query_id, actor_id: rapi.actor_id,
                      value: opts.value, // F-QUERY-CUSTOM-VALUE
                      q_action:(opts.q_action || '').toString(),
                      q_arg: (opts.q_arg || {})}
          //console.log('setting QUERY reaction with rarg',rarg)
          // мб переделать query_id перенести в урль, а там - ну что прислали то и давать, не смешивать в query

          // где-то тут я перегнул палку. видимо передавая аргументы в операцию..
          //console.log("QUERY SEND REACTION",crit)
          let deployed_reaction_promise = rapi.reaction( crit, opts ).action( rapi.operation( "do_query_send", rarg ),{value:opts.value} )
          // reaction action defined

          query_cb_dic.get( query_id ).rp = deployed_reaction_promise          
          // типа возвращаем промису посылки сообщения. хм.
          // и она разрезолвится когда мы получим подтверждение
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

              // итак мы на клиенте и у нас есть msg
              // считаем что на клиенте есть глобальный метод fetch
              // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
              //let packet = {query_id:rarg.query_id, m:msg}

              // F-DIRECT
              if (rapi.actor_id && rapi.actor_id == rarg.actor_id) {
                // о так это ж мы сами
                if (rapi.verbose)
                  console.log("query: direct submit in local process ",msg.label,rapi.actor_id)
                return rapi.submit_direct_query_reply( rarg.query_id,msg )
              }

              //if (rapi.verbose) 
                // console.log('query: sending msg label',msg.label,'to',rarg.results_url, 'rarg=',rarg)
              //msg = {...msg}
              //delete msg['label']
              //console.log("sending msg=",msg)

              return fetch_packet( rarg.results_url, rarg.query_id, msg ).then( res => {
                  //if (rapi.verbose) console.log('query: msg label',msg.label,'to',rarg.results_url, 'is sent')
                  } ).catch( err => {
                     console.log('query: query sending msg fetch error',err,msg)
                     console.error('query: query sending msg fetch error',err,msg)
                  } )
            
          }    

/*
  let do_query_send_old = (msg,rarg) => {
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
               // todo может inmem?
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

              // if (rapi.verbose) console.log('query: sending msg label',msg.label,'to',rarg.results_url, 'rarg=',rarg,'packet=',packet)

              return fetch_packet( rarg.results_url, packet ).then( res => {
                  //if (rapi.verbose) console.log('query: msg label',msg.label,'to',rarg.results_url, 'is sent')
                  } ).catch( err => {
                     console.log('query: query sending msg fetch error',err,msg)
                     console.error('query: query sending msg fetch error',err,msg)
                  } )
            })
          }
*/          

  return {query, do_query_send, submit_direct_query_reply:process_incoming_message}
}


let clients = new Map()
import * as net from "node:net"

let last_sent_message
let last_message_buf

// посылает сообщение по указанному url
function fetch_packet( target_url, query_id, msg ) {
  console.log("fetch_packet",{target_url, query_id, msg})

  if (console.verbose)
      console.verbose("fetch_packet",{target_url, query_id, msg})

  let client = clients.get( target_url.url )

  //console.log("fetch client found=",!!client)

  if (!client) {

    // F-SOCKS
    let proxy_fn = global.proxy_fn
    if (proxy_fn) {
      let socks_addr = proxy_fn( target_url.url );
      if (socks_addr) {
        console.log("socks_addr mode, creating socks proxy conn! socks_addr=",socks_addr)
        let [host,port] = socks_addr.split("://")[1].split(":")        
        // https://www.npmjs.com/package/socks
        const options = {
          proxy: {
            host, // ipv4 or ipv6 or hostname
            port:parseInt(port),
            type: 5 // Proxy version (4 or 5)
          },

          command: 'connect', // SOCKS command (createConnection factory function only supports the connect command)

          destination: {
            host: target_url.host, // github.com (hostname lookups are supported with SOCKS v4a and 5)
            port: target_url.port
          }
        };
        client = {}
        client.opened = create_promise()
        SocksClient.createConnection(options).then( info => {
          console.log("socks connected!",info)
          client.opened.resolve( info.socket )
        }).catch( err => {
          console.error("socks connect error! options=",options,"err=",err)
        })        
        clients.set( target_url.url,client )
      }
      
    }

    // socks не воспользовались - создаем обычный клиент
    if (!client) {
      // console.error("creating client. target_url=",target_url)
      client = new net.Socket()
      clients.set( target_url.url,client )

      //setTimeout( () => console.log("."), 100 )

      client.opened = create_promise()
      client.on('ready', () => {
        //if (console.verbose)
        //console.error("created client. target_url=",target_url,"me=",client.address())
        client.opened.resolve(client)
      });
      client.on('error', (err) => {
        console.error("query-tcp: outgoing socket error!",err,"me=",client.address())
      });
      client.on('close', (err) => {
        console.error("query-tcp: outgoing socket close!",err,"me=",client.address())
      });
      client.on('timeout', (err) => {
        console.error("query-tcp: outgoing socket timeout!",err,"me=",client.address())
      });
      client.on('end', (err) => {
        console.error("query-tcp: outgoing socket end!",err,"me=",client.address())
      });
      client.connect( {host:target_url.host, port: target_url.port, keepAlive: true} )
      client.setKeepAlive( true )
    }
  }

  // F-MSG-ATTACH
  /*
  let attach
  if (msg.attach) {
    attach = msg.attach
    delete msg['attach']
  }
  */

  

  //let str = JSON.stringify(msg)
  //let attach = Buffer.from( str )

  // другой алгоритм. просто для повторных сообщений
  let attach
  
  if (msg === last_sent_message) {
    attach = last_message_buf
    //console.log("hit")
  } else {
    last_sent_message = msg
    let str = JSON.stringify(msg)
    last_message_buf = Buffer.from( str )
    attach = last_message_buf
    //console.log("miss")
  }  

/*
  let attach = msg.__packed
  if (!attach) {
    let str = JSON.stringify(msg)
    msg.__packed = Buffer.from( str )
    attach = msg.__packed
    //console.log("buff MIS match! patched msg=",msg,"bblen=",attach.length)
  } else {
    //console.log("buff match!")
  }
*/  

  //let buf = Buffer.from( query_id )
  let bufferInt = Buffer.allocUnsafe(4);
  bufferInt.writeUInt32BE( query_id )
  let bufferIntAttach = Buffer.allocUnsafe(4);

  bufferIntAttach.writeUInt32BE( attach ? attach.length : 0 )

  return client.opened.then( (socket) => {
    // console.log("fetch-packet ACTUAL to",target_url,"me=",client.address(),"msg=",msg)  
    //client.cork() // на удивление добавка corn-uncork снижает скорость в 2 раза вычислений
    socket.write( bufferInt )
    socket.write( bufferIntAttach )
    //client.write( buf )
    //if (attach)
      //client.write( Buffer.from( attach.buffer ) )
    socket.write( attach )
    //client.uncork()
    // непонятно как лучше, 1м врайтом или несколькими
    // один зато ясно что слать.. но как оно там внутрях?
    // но один - это доп аллокация..
    //client.write( Buffer.concat( [bufferInt,bufferIntAttach,buf]) )
  })
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


function start_message_server( client_id, message_arrived,port=0,host='0.0.0.0',allow_find_free_port=true) {
//  function start_message_server( message_arrived,port=11000,host='127.0.0.1',allow_find_free_port=true) {

    const server = net.createServer({highWaterMark:1024*1024});
    //const server = net.createServer();

    /* внимание важная засада. если создать сервер, а потом закрыть, но к нему были соединения
    то он продолжает с ними работать.
    при этом - если заказать создание новый сервер на том же порту, то он создатся
    и при этом - сообщения получается будет получать старый сервер!
    */
    //console.log("start_message_server called",{client_id})

    //httpClose({ timeout: 2000 }, server)
        
    //server.keepAliveTimeout = 60*1000*30 // сдался.. 30 минут таймаут ставлю кипалайва.. потому что note-fetch отваливается.. не помогает ему мой патч..
    
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        if (allow_find_free_port) {
          //console.log('Address in use, retrying...');
          port = port+1;
          server.listen( port,host );
        }
        else {
          throw e
        }
      }
    });

    // используем
    // https://github.com/bmancini55/node-playpen/blob/c53647b44aa19fa20fee7c73a7793713e2a2a091/custom-socket/json-socket.js#L4
    // мысли - мб потоково парсить json по мере поступления.. ну ладно, он мелкий у нас..
    server.on("connection",(client) => {
      //console.log("client connected",client)
      let len
      let waitingBody=false
      let len_att
      let cli_addr = `${client.remoteAddress}:${client.remotePort}`

      let consume = make_consumer( process_incoming, cli_addr )

       client.on("error",(err) => {
        console.log("query-tcp: incoming socket error! cli_addr=",cli_addr,err)
       })

       client.on("data",(buf) => {
         consume(buf,cli_addr)
       })

    })

    server.listen( port,host );

    return new Promise( (resolve, reject) => {

      server.on("listening",() => {
        if (console.verbose)
            if (console.verbose)('incoming msg tcp server started at:', server.address());
        //console.log('http server started: http://%s:%s', server.address().address, server.address().port);
        //server.address().address
        let adr = process.env['PPK_PUBLIC_ADDR'] || '127.0.0.1'
        let url = `tcp://${adr}:${server.address().port}`
        let my_endpoint_url = {host:adr, port: server.address().port, url, client_id }
        if (console.verbose)
            if (console.verbose)({my_endpoint_url})
        resolve( {server,my_endpoint_url} )
      });

    })    

    function process_incoming( query_id, data, rinfo ) {
      //console.log(rcounter++,": tcp incoming message of len",msg.length)

      //let data = msg.toString("utf-8")

      let d = {}
      if (data.length > 0)
        try {
          d = JSON.parse( data ); // короче там сообщения у нас мелкие в основном.. может и не надо нам потоковый парсинг
          //console.log("incoming message data=",d,"from",rinfo)
          //console.log("incoming message data=",typeof(data),data.length)
        } catch (err) {
          console.warn("query-tcp: request json parse error", err.message)
          console.warn("query-tcp: incoming message data=",data)
          return
        }
        //d.sender = `${d.sender || ''}/${rinfo.address}/${rinfo.port}`

        //console.log("calling message-arrived. query_id=",query_id,"d=...")
        message_arrived( query_id, d )
    }

}

function make_consumer( process_incoming, cli_addr) {

    let state = 0 // 0 = waiting new, 1 = constructing body
    //let bufs = []
    let prevbuf = null
    let query_id, len

    function consume( buf ) {
       //console.log("QQQ consume. cli_addr=",cli_addr,"prevbuf=",prevbuf,"buf=",buf)
       let bstart = 0
       while (buf) {
         //console.log("QQQ consume tick. state=",state,"cli_addr=",cli_addr,"bstart=",bstart,"prevbuf=",prevbuf,"buf=",buf)

         if (prevbuf) {
           buf = Buffer.concat( [prevbuf, buf] )
           prevbuf = null
         }

         if (state == 0) 
         {
           if (buf.length < 8+bstart) {
             prevbuf = (bstart > 0) ? buf.subarray( bstart ) : buf
             return
           }

           query_id = buf.readUInt32BE(bstart)
           len = buf.readUInt32BE(bstart+4);
           bstart += 8
           //buf = buf.subarray( 8 )

            if (len > 2 ** 18) {
              console.log("query-tcp: parsed len is strange",len)
              console.error("query-tcp: parsed len is strange",len)
              throw new Error('Max json length exceeded');
              return;
            }

           state = 1
         }

         if (state == 1) {
           //console.log("QQQ in state 1. len=",len,"bstart=",bstart,"query_id=",query_id)
           if (buf.length < len+bstart) {
             //console.log("QQQ buf is small",buf.length,len,bstart)
             prevbuf = buf.subarray( bstart )
             return
           }
           let str = buf.toString( "utf-8",bstart,bstart+len)
           //console.log("QQQ str=",str)
           if (buf.length > len + bstart) {
             //buf = buf.subarray( len+bstart )
             bstart += len
           }
           else {
             buf = null
           }
           state = 0
           //console.log("QQQ cb,",query_id,str)
           process_incoming( query_id, str,cli_addr )
          }

        }
    }

    return consume
}
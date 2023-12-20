#!/usr/bin/env node

// представитель веб-клиента по протоколу ws

/* главная цель - уметь выполнять query. потому что надо быть в сети (для http..)
   а так получается, те кто публикуют сообщения - они по http/tcp веб-клиенту послать не могут

   ну и допом - ретранслировать (msg) все прочие сообщения.
   получается что реакции выполняются на них тут, а не в веб-клиенте..
   что позволяет в частности - другим подписаться на эти сообщения.
   удобно.
*/

/* принимает от клиента сообщения по WS и ретранслирует их в сеть как обычный клиент
   принимает из сети по http/tcp сообщения и ретранслирует их клиенту по WS
   
   при этом веб-клиент параллельно НЕ общается с main-сервером. ему достаточно вот этого сервера..
*/


import * as PPK from "ppk"

import WebSocket from 'ws';
import { WebSocketServer } from 'ws';

PPK.prefix_console_log( () => ["[repr-ws]"] )

export class RepresenterWS {
  constructor( port, verbose )
  {

    let wss = new WebSocketServer({
      host: "0.0.0.0",
      port: port,
      perMessageDeflate: false,
      skipUTF8Validation: true,
      maxPayload: 200*1024*1024
    })
    // https://github.com/websockets/ws/blob/HEAD/doc/ws.md#websocketbinarytype
    
    wss.on('listening', () => {
      console.log('repr-ws server started at',wss.address())
    })

    wss.on('connection', (ws) => {
      // todo можно указать урль мейна
      PPK.connect("repr-ws").then(rapi => {
        this.on_client_connection( rapi, wss, ws, verbose ) 
      })
    });
  }

  on_client_connection( rapi, wss, ws, verbose ) 
  {
    function send2client( json ) {
      //console.log("send to client",json)
      ws.send( JSON.stringify(json) )
    }

    let queries_r = []
    
    ws.on('message', (data) => {
      // веб-клиент прислал сообщение
      let msg = JSON.parse( data )
      //console.log("msg from client",msg)
      // если это query - транслируем его в сеть, ответы возвращаем клиенту
      if (msg.query) {
        //console.log('ws see query, invoking:',msg.crit)
        let k = rapi.query( msg.crit, msg.opts, msg.arg )

        k.done( (foundmsg) => {
          //console.log('ws see incoming msg to query',foundmsg)

          if (foundmsg?.value?.payload_info && foundmsg.value.payload_info.length > 0)
          {
            //console.log("data required. it has payload: ", val.payload_info[0])
            rapi.get_one_payload( foundmsg.value.payload_info[0] ).then( data => {
              //console.log("ok it loaded. re-submitting!")
              var array = Array.from(data);
              foundmsg.value.payload = [ array ]
              delete foundmsg.value['payload_info']
              // итого мы сделали копию. и только после этого передали управление.              
              // todo - посылать двоично (ввести на канале автомат)
              send2client( {query_reply: msg.query, m: foundmsg} )
            })
          } else 
              send2client( {query_reply: msg.query, m: foundmsg} )
          
        })
        
        queries_r.push( k )
      } else {
        // если это не query - просто передаем в сеть.
        //console.log("forwarding to rapi")
        rapi.msg( msg )
      }
    })
    
    send2client( {hello:true,server_t0:rapi.server_t0} )

    ws.on('close', () => {

      for (let k of queries_r) {
        //console.log("k=",k)
        k.delete() // уберем реакции доставок явно..
      }

      rapi.exit()
    })
  }
}

let rws = new RepresenterWS( 12000 )

#!/usr/bin/env node

// представитель клиента ws

/* главная цель - уметь выполнять query. потому что надо быть в сети (для http..)
   а так получается, те кто публикуют сообщения - они по http веб-клиенту послать не могут

   ну и допом - ретранслировать (msg) все прочие сообщения.
   получается что реакции выполняются на них тут, а не в веб-клиенте..
   что позволяет в частности - другим подписаться на эти сообщения по http.
   удобно.
*/

/* принимает от клиента сообщения и ретранслирует их в сеть как обычный клиент
   принимает из сети по http сообщения и ретранслирует их клиенту
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
      ws.send( JSON.stringify(json) )
    }

    let queries_r = []
    
    ws.on('message', (data) => {
      let msg = JSON.parse( data )
      //console.log("repr-ws: msg from client",msg)
      if (msg.query) {
        //console.log('ws see query, invoking:',msg)
        let k = rapi.query( msg.crit, msg.opts, msg.arg )

        k.done( (foundmsg) => {
          //console.log('ws see incoming msg to query',foundmsg)
          send2client( {query_reply: msg.query, m: foundmsg} )
        })
        
        queries_r.push( k )
      } else {
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

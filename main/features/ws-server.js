// доступ к серверу через вебсокеты

//import {add} from "../../main.js"

import WebSocket from 'ws';
import { WebSocketServer } from 'ws';

export class PPKWebsocketServer {
  constructor( lm, port, verbose )
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
      console.log('ws server started at',wss.address())
    })

    wss.on('connection', (ws) => this.on_client_connection( lm, wss, ws, verbose ) );
  }

  on_client_connection( lm, wss, ws, verbose ) 
  {
    function send( json ) {
      if (verbose) console.log("sending msg:",json)
      ws.send( JSON.stringify(json) )
    }
    let listening = new Map()
    ws.on('message', (data) => {
      let msg = JSON.parse( data )
      if (verbose) console.log("incoming msg:",msg)
      let resp = {status:'ok', opcode: msg.cmd+"_reply", cmd_reply: msg.cmd, crit: msg.crit }
      // todo cmd_reply лишнее
      let list = lm.get( msg.crit )
      if (msg.cmd == 'begin_listen_list') {
        // начинаем слушать (клиент начинает)
        resp.entries = list.entries()
        //console.log("so we begin: client want listen",msg.crit,resp)

        let unlisten = list.add_listener( (opcode,arg) => {
          //console.log('listener called! sending:',{opcode,arg,crit:msg.crit})
          // если в этот список присылают изменение - уведомляем этого клиента
          send( {opcode,arg,crit:msg.crit} ) /// уведомление об изменениях
        })
        listening.set( msg.crit, unlisten )
      }
      else if (msg.cmd == 'end_listen_list') {
        // закончили слушать
        listening.delete( msg.crit )
      } else if (msg.cmd == 'add_item') {
        // положим
        //console.log("adding reaction item",msg)
        list.set( msg.name, msg.value )
        // todo можно вроде как убрать - я не увидел permanent в отправках
        if (!msg.permanent) { // не постоянная реакция - сообразно надо удалить при отключении слушателя
          let name_to_rm = msg.name
          //console.log('addling rm-item item:',msg.crit,name_to_rm)
          listening.set( `${msg.crit}/${msg.name}`, () => {
            //console.log("removing item due client removed",msg.crit,name_to_rm)
            list.delete( name_to_rm )
          } )
        }
        // вот тут можно было бы подождать пока произойдет рассылка (отработают листенеры)
        //console.log("thus entries are",list.entries(),list)
        resp.name = msg.name
      } else if (msg.cmd == 'delete_item') {
        // уберем
        list.delete( msg.name )
        // элемент удален явно, сообразно удалять его потом уже не надо
        listening.delete( `${msg.crit}/${msg.name}` ) // мы ему сказали, что итема удалилась, больше говорить не надо будет
      } 
/*      else if (msg.cmd == 'get_time') {
        msg.value == performance.now()
      }*/
      send(resp)
    })

    ws.on('close', () => {
      for (let unlisten of listening.values()) {
        //console.log("calling unlisten",unlisten)
        // очищаем все что добавил этот клиент, и все что он слушал
        unlisten()
      }
    } )
    
    send( {hello:'get_time', server_time: performance.now() } )
  }
}

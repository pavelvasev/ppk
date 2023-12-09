#!/usr/bin/env node

import * as PPK from "../../client-api/client-api.js"
import {Korzinka} from "./lib.js"

PPK.prefix_console_log( () => ["[korzinka]"] )

PPK.connect("korzinka").then(rapi => {
  console.log("connected")

  let korzinki = new Map()

  // отдельный вебсокет на тему получения реакций, клиентский не оч удобно
  let list_ws = rapi.websocket_fn( rapi.url )
  list_ws.on('open',() => {
      console.log("list-ws connected")

      rapi.query( 'create-korzinka' ).done( msg => {
        //console.log('query got a',msg)
        let k = korzinki.get( msg.crit )
        if (k) {
          k.add_use() // т.е. та же корзинка продолжит
        }
        else {
            
            k = new Korzinka( rapi, msg.crit, msg.ms )
            korzinki.set( msg.crit, k )
            //console.log("sending to list-ws message",{begin_listen_list:msg.crit})

            // смешно то что она первым делом на свою реакцию отреагирует )))) ладно хоть сообщений еще нет
            list_ws.send( JSON.stringify({cmd:'begin_listen_list',crit:msg.crit}) )
        }
      })
      // todo destroy korzinka
      // list_ws.send( JSON.stringify({cmd:'end_listen_list',crit:k.crit}) )


  })

  list_ws.on('message', (data) => {
    let msg = JSON.parse( data )
    if (msg.opcode == 'set') {
      //console.log("notified opcode set",msg)
      let k = korzinki.get( msg.crit )
      if (k)
        k.set( msg.arg.name, msg.arg.value )
    }
  })

})


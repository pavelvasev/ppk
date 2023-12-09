#!/usr/bin/env node

/* печатает сообщения системы по критерию из командной строки
   если указать N то остановится напечатав N значений
   значения вновь прибывающие и сохраненные в ms
   если значения нет - ждет.
   
   пример
   
   N=1 get.js cube1
   - напечатает 1 сообщение с меткой cube1

   идеи потребностей: (пока не актуально но на будущее)
   * пропустить сколько-то значений. это можно сделать на уровне реакций - что она пропускает сколько то и потом уже срабатывает
   * завершиться если нет значений (не ждать если нет значений)
   * напечатать все и завершиться
   
   
*/

import * as PPK from "../client-api/client-api.js"

import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

PPK.prefix_console_log( () => [performance.now()] )

function restart() {
PPK.connect("get",undefined,process.env.VERBOSE).then(ppk => {
  console.log("connected")
  //let crit = process.argv[2];
  let crit="runner-finished"
  console.log({crit})
  let opts = {}
  //opts.N = process.env.N
  //opts.only_new = true
  let counter = 0
  ppk.query( crit,opts ).done( (res) => {
    let info = res.id
    //console.log(res)
    if (!process.env.FAILS || (process.env.FAILS && !res.success))
        console.log( counter++,res.runner_id, res.time_used_ms,"ms :",res.hint,'id',res.id,'success',res.success,res.error_msg || '')
    //counter++
    //if (counter >= opts.N) process.exit(0) // завершение процесса
  });
  
  ppk.ws.on('close', () => { ppk.exit(); setTimeout( restart, 1000 ) } )
}).catch( err => {
  setTimeout( restart, 1000 )
})
}

restart()
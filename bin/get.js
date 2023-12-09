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

PPK.connect("get",undefined,process.env.VERBOSE).then(ppk => {
  console.log("connected")
  let crit = process.argv[2];
  if (!crit) {
    console.log("usage: get.js crit");
    process.exit(1)
  }
  console.log({crit})
  let opts = {}
  opts.N = process.env.N
  //opts.only_saved = process.env.SAVED
  let counter = 0
  ppk.query( crit,opts ).done( (res) => {
    console.log("%s",JSON.stringify(res,null,1))
    counter++
    if (counter >= opts.N) process.exit(0) // завершение процесса
  });
})


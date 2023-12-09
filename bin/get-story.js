#!/usr/bin/env node

/* печатает в stderr сообщения системы по критерию из командной строки
   критерий может содержать несколько меток через запятую, тогда выбираются сообщения по любой из этой метки

   пример
   
   get-story.js exec-request,runner-info
   - будет печатать сообщения по критерию exec-request и критерию runner-info

   сообщения печатаются в формате 1 строчка = 1 json-запись. это позволяет записать это в файл и затем использовать в put-story.js.
   
   
*/

import * as PPK from "../client-api/client-api.js"

import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

PPK.connect("get",undefined,process.env.VERBOSE).then(ppk => {
  console.log("connected")
  let s = process.argv[2];
  if (!s) {
    console.log("usage: get-story.js crit");
    process.exit(1)
  }
  let crits = s.split(",")
  console.log("started story:",{crits})
  let opts = {}
  let counter = 0
  for (let crit of crits) {
    ppk.query( crit,opts ).done( (res) => {
      res.timestamp = performance.now()
      console.error("%s",JSON.stringify(res))
      console.log(counter++)
    });
  }
})


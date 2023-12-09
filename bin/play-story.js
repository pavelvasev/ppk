#!/usr/bin/env node

/* проигрывает сообщения из потока stdin.
   сообщения должны идти в кодировке json по одному сообщению в строке


*/

import * as PPK from "../client-api/client-api.js"
PPK.prefix_console_log( () => [`[play-story]`,performance.now()] )

import * as readline from 'node:readline';


import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

PPK.connect("get",undefined,process.env.VERBOSE).then(rapi => {
  console.log("connected")
  
  const rl = readline.createInterface({
  input: process.stdin
  })  

  rl.on('line', (line) => {
    //console.log(line);
    let msg = JSON.parse( line )
    //console.log('sending msg',msg)
    append( msg )
  });
  
  let arr = []
  let t0 = null
  let h = null
  function append( msg )
  {
    arr.push( msg )
    //console.log("play-story: got msg")
    tryplay()
  }

  function tryplay() {
    let tm = performance.now()
    //console.log("tryplay",tm, arr.length)
    while (arr.length > 0) {
      let next_msg = arr[0]
      if (t0 == null) t0 = next_msg.timestamp
      //console.log({next_msg})

      let msg_relative_time = next_msg.timestamp - t0
      //console.log( "ckh", msg_relative_time, tm )
      if (msg_relative_time < tm || process.env.PLAYFULL) {
        //console.log("ok sending", msg_relative_time, tm, next_msg)
        arr.shift()
        rapi.msg( next_msg )
      } else {
        break
      }
    }
    if (arr.length > 0 && h == null)
      h = setTimeout( () => { h = null; tryplay() }, 1 )
  }

})


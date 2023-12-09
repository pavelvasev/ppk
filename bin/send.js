#!/usr/bin/env node

/* посылает сообщение в систему
   send.js json-encoded-msg
   
   F-SEND-CMDLINE
*/

import * as PPK from "../client-api/client-api.js"

import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

PPK.connect("send",undefined,process.env.VERBOSE).then(ppk => {
  console.log("connected")

  let str = process.argv[2]
  if (!str) {
    console.log("usage: send.js msg");
    process.exit(1)
  }
  console.log(str)
  let msg = JSON.parse( str );
  ppk.msg( msg )
})


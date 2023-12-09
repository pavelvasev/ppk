#!/usr/bin/env node

import * as PPK from "../../../client-api/client-api.js"

PPK.connect("test",undefined,true).then(rapi => {
  console.log("connected")
  
  rapi.exec( rapi.js( arg => {
    return arg.i+1
  }, {i:10}), {hint:"incr-i"} ).done( r => {
    console.log("Exec result is",r)
  });

})
#!/usr/bin/env node
// тестируем много задач

import * as PPK from "../../../client-api/client-api.js"

PPK.connect("test").then(rapi => {
  console.log("connected")
  
  let n = 100000 //0000
  for (let i=0; i<n; i++) {
    console.log("spawning",i)
    let k = i;
  rapi.exec( rapi.js( arg => {
    return arg.i+1
  }, {i}), {hint:"incr-i"} ).done( r => {
    console.log("Exec result for",k,"is",r)
    if (k == n-1) {
        console.log("all done, exiting")
        //mozg.add( {label:'terminate'} )
        rapi.exit()
      }
  });
  
  }


})
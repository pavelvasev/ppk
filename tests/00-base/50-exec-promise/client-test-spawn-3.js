#!/usr/bin/env node
// тестируем много задач

import * as PPK from "ppk"

PPK.connect("test").then(rapi => {
  console.log("connected")

  let n = 100000
  let prev = 0
  for (let i=0; i<n; i++) {
    console.log("spawning",i)
    let k = i;
    prev = rapi.exec( rapi.js( arg => {
      return arg.i+1
    }, {i:prev}) )
  }
  
  console.log("prev is",prev)
  
  rapi.wait_promise(prev).then( res => {
    console.log("done!",res)
    rapi.exit()
  })

})
#!/usr/bin/env node
// тестируем много задач
// вариант с передачей управления setImmediate - чтобы отправляло не дожидаясь всего набора

import * as PPK from "ppk"

PPK.connect("test").then(rapi => {
  console.log("connected")

  let prev = 0
  setup( 100*1000 )
  //setup( 10 )

  function setup( n ) {
    if (n <= 0) {
      console.log( {prev} )
      prev.done( res => {
      console.log("done!",res)
      rapi.exit()
    })
      return
    }
    console.log('spawning',n)
    prev = rapi.exec( rapi.js( arg => {
      return arg.i+1
    }, {i:prev}) )
  
    prev.then( () => setImmediate( () => setup(n-1) ) )
  }



})
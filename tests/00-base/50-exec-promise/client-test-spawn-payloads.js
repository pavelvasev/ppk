#!/usr/bin/env node
// тестируем много задач
// вариант с передачей управления setImmediate - чтобы отправляло не дожидаясь всего набора

import * as PPK from "ppk"

PPK.connect("test").then(rapi => {
  console.log("connected")

  let prev = {num:0}
  //setup( 100*1000 )
  setup( 10 )

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
      console.log('!!!!!!!!! hello i exec. arg is:',arg)
      return { num : arg.i.num+1, payload: [new Int32Array(100)] }
    }, {i:prev}) )
  
    prev.then( () => setImmediate( () => setup(n-1) ) )
  }



})
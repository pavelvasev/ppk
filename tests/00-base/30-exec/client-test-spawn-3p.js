#!/usr/bin/env node
// вариант с ожиданием постановки - итого ставим задачи и сразу получаем результаты
// а иначе ws захватывают все и задачи ставятся после только размещения реакций.

import * as PPK from "../../../client-api/client-api.js"

PPK.connect("test").then(rapi => {
  console.log("connected")
  setup( rapi,100000)
  //setup( rapi,100*1000 )
})

function setup( rapi,i ) {
  if (i <= 0) return

  console.log("spawning",i)
  let k = i;
  
  rapi.exec( rapi.js( arg => {
    return arg.i+1
  }, {i}), {hint:"incr-i"} ).done( r => {
    console.log("Exec result for",k,"is",r)
    if (k == 1) {
        console.log("all done, exiting")
        //mozg.add( {label:'terminate'} )
        rapi.exit()
      }
  }).then( submitted => {
    setImmediate( () => {
      setup( rapi,i-1 ) //setImmediate
    })
  });
}
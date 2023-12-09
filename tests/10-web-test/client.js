#!/usr/bin/env node

import * as PPK from "../../client-api/client-api.js"

PPK.connect("test",undefined,true).then(rapi => {
  console.log("connected")
  
  rapi.query( 'a' ).done( msg => {
    console.log('query got a',msg)
  })
  
  let cnt=0
  setInterval( () => {
    console.log('sending',cnt)
    //rapi.msg( {label:'b',cnt:cnt++,blobb: Array.from(new Int32Array(100000))} )
    let arr = Array.from({length: 100*1000}, () => Math.floor(Math.random() * 100) + 1)
    rapi.msg( {label:'b',cnt:cnt++,blobb: arr} )
     
  }, 10)

})
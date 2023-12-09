#!/usr/bin/env node

import * as PPK from "../../../client-api/client-api.js"

PPK.connect("test",undefined,true).then(rapi => {
  console.log("connected")
  
  console.log("sending create-korzinka")
  rapi.msg( {label:'create-korzinka',crit:'b',ms:1000} )
  
  setTimeout( () => {
   console.log("************************** sending b")
      rapi.msg( { label:'b', b: 1, payload: [new Float32Array(100)]} )
      rapi.msg( { label:'b', b: 2} )
      rapi.msg( { label:'b', b: 3} )
  }, 100 ) // надежда что корзинки сработают

  setTimeout( () => {
   console.log("************************ query b")
    rapi.query( 'b' ).done( msg => {
      console.log('query got b',msg)
    })
  }, 200 )
  
})
#!/usr/bin/env node

import * as PPK from "../../../client-api/client-api.js"

PPK.connect("test",undefined,true).then(rapi => {
  console.log("connected")
  
  rapi.query( 'b' ).done( msg => {
    console.log('query got b',msg)
    if (msg.payload_info) {
      rapi.get_payloads( msg.payload_info ).then( arr => {
        console.log("payloads loaded:",arr)
      })
    }
  }).then( () => {

      rapi.msg( { label:'b', b: 1, payload: [new Float32Array(100)]} )
      rapi.msg( { label:'b', b: 2} )
      rapi.msg( { label:'b', b: 3} )
  })
})
#!/usr/bin/env node

import * as PPK from "../../../client-api/client-api.js"

PPK.connect("test",undefined,true).then(rapi => {
  console.log("connected")
  
  rapi.query( 'b' ).done( msg => {
    console.log('query got b',msg)
  }).then( () => {

      rapi.msg( { label:'b', b: 1} )
      rapi.msg( { label:'b', b: 2} )
      rapi.msg( { label:'b', b: 3} )

  })
})
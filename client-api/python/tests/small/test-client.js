#!/usr/bin/env node

import * as PPK from "ppk/client-api/client-api.js"

PPK.connect("test",undefined,true).then(rapi => {
  console.log("connected")
  rapi.msg( { label:'test', a: 5, b: 7} )

  /*mozg.query( "c",(kv) => {
    console.log("q result",kv)
  });*/
  
  /*
  rapi.reaction( 'b' ).action( msg => {
    console.log('reacting on b',msg)
  }).then( () => {
  
    rapi.reaction( 'b' ).action( msg => {
      console.log('reacting on b-2',msg)
    }).then( () => {

      rapi.msg( { label:'b', b: 1} )
      rapi.msg( { label:'b', b: 2} )
      rapi.msg( { label:'b', b: 3} )
    
    })
  })
  */

})
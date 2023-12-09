#!/usr/bin/env node

import * as PPK from "ppk/client-api/client-api.js"

PPK.connect("test",undefined,true).then(rapi => {
  console.log("connected")
  //rapi.msg( { label:'test', a: 5, b: 7} )

  rapi.query( "test" ).done( (kv) => {
    console.log("query result",kv)
  })
  
  let counter=0
  setInterval( () => {
    counter++
    console.log("sending test2")
    rapi.msg( {label:"test2",counter} )
  }, 1000 )
  
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
#!/usr/bin/env node

// todo что за непонятная фуункция action у квери?

import * as PPK from "ppk";

PPK.connect("test",undefined,true).then(rapi => {
  console.log("connected")
  
  rapi.query( 'b' ).action(msg => {
    //msg.qq = msg.b*10
    //return msg
    return msg.b*10
  }).done( msg => {
    console.log('query got b',msg)
  }).then( () => {

      rapi.msg( { label:'b', b: 1} )
      rapi.msg( { label:'b', b: 2} )
      rapi.msg( { label:'b', b: 3} )

  })
})
#!/usr/bin/env node

import * as PPK from "../../../client-api/client-api.js"
import req_init from "../../../client-api/req.js"
import promises_init from "../../../services/promises/promises-client.js"

import * as STARTER from "../../../client-api/starter.js"
let S = new STARTER.Local()

S.start().then( info => PPK.connect("test",info) )
.then( rapi => {
/*
  let p0 = req_init( rapi, rapi.query ).then( req_api => {
    rapi.request = req_api.request.bind( req_api )
    rapi.reply = req_api.reply.bind( req_api )

    return promises_init( rapi, rapi.query, rapi.request ).then( promises_api => {
      rapi.promises = promises_api
      return rapi
    })
  })

  return p0

  let req_api = req_init( rapi, rapi.query )
  rapi.request = req_api.request.bind( req_api )
  rapi.reply = req_api.reply.bind( req_api )
  // не очень удобный вариант надо сказать с этим bind

  let p1 = promises_init( rapi, rapi.query, rapi.request ).then( promises_api => {
    rapi.promises = promises_api    
    rapi
  })

  return Promise.all( [p1] ).then( arr => rapi )

  //rapi.promises = promises_init( rapi, rapi.query, rapi.request )
  //return rapi
*/

  ///////////////////////
  let req_api = req_init( rapi, rapi.query )
  rapi.request = req_api.request.bind( req_api )
  rapi.reply = req_api.reply.bind( req_api )
  
  rapi.promises = promises_init( rapi, rapi.query, rapi.request )
  return rapi

  /*
  return promises_init( rapi, rapi.query, rapi.request ).then( promises_api => {
    rapi.promises = promises_api    
    return rapi
  })
  */

  //return rapi.promises.ready.then( () => rapi )

})
.then(rapi => {
  console.log("connected")

  // асинхронное создание промисов это смешное
  let k =  rapi.promises.create_promise()
  console.log("k=",k)
  k.then( p1 => {
    rapi.promises.wait_promise( p1 ).then( value => {
      console.log("p1 resolved!",value)
      rapi.exit()
    })
    setTimeout( () => {
      rapi.promises.resolve_promise( p1, 333 )
    },100)
  })
  
})
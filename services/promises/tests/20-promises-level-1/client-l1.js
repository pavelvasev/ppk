#!/usr/bin/env node

import * as PPK from "ppk/client-api/client-api.js"
import req_init from "ppk/client-api/req.js"
import promises_init from "ppk/services/promises/promises-client.js"

import * as STARTER from "ppk/client-api/starter.js"
let S = new STARTER.Local()

S.start().then( info => PPK.connect("test",info) )
.then( rapi => {
  ///////////////////////
  let req_api = req_init( rapi, rapi.query )
  rapi.request = req_api.request.bind( req_api )
  rapi.reply = req_api.reply.bind( req_api )
  
  rapi.promises = promises_init( rapi, rapi.query, rapi.request )
  return rapi
})
.then(rapi => {
  console.log("connected")

  // асинхронное создание промисов это смешное
  let k =  rapi.promises.create_promise()
  console.log("k=",k)
  
  rapi.promises.wait_promise( k ).then( value => {
    console.log("k resolved!",value)
    rapi.exit()
  })

  setTimeout( () => {
    rapi.promises.resolve_promise( k, 333 )
  },100)
  
  
})
#!/usr/bin/env node

import * as PPK from "../../../client-api/client-api.js"
import req_init from "../../../client-api/req.js"
import promises_init from "../../../services/promises/promises-client.js"

import * as STARTER from "../../../client-api/starter.js"
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
  rapi.promises.create_promises(10).then( arr => {
    console.log("created promises",arr)
    rapi.promises.wait_promise( arr[5] ).then( value => {
      console.log("arr[5] resolved!",value)
      rapi.exit()
    })

    let wall = rapi.promises.when_all( arr )
    rapi.promises.wait_promise( wall ).then( value => {
      console.log("arr[5] resolved!",value)
      rapi.exit()
    })

    setTimeout( () => {
      rapi.promises.resolve_promise( arr[5], 555 )
    },100)
  })
  
})
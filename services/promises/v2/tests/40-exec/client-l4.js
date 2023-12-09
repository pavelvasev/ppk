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
  S.start_workers( 1,4 )

  // асинхронное создание промисов это смешное
  let d = rapi.submit_payload( new Float32Array( 100 ) )
  let k = rapi.promises.add_data( d )

  let e = rapi.exec( rapi.js( args => {
    return rapi.get_payload( args.a ).then( data => {
      let res = data.map( x => x + args.b )
      return res
    })
  },{a:k, b:5 }) )
  
  rapi.promises.wait_promise( e ).then( value => {
    console.log("k resolved!",value)
    // todo нужна какая-то удобная де-сериализация - возврат к исходному value или типа того
    // а для этого надо сделать таски и уже играть от них.
    rapi.get_payload( value ).then( data => {
      console.log("loaded k-data",data)
    })
    rapi.exit()
  })  
  
})

/*
function plus( array, coef )
{
  rapi.define( "plus", rapi.js( args => {
    return rapi.get_payload( args.a ).then( data => {
      let res = data.map( x => x + args.b )
      return res
    })
  }) )
} 
*/
#!/usr/bin/env node

import * as PPK from "../../../client-api/client-api.js"
import req_init from "../../../client-api/req.js"

import * as STARTER from "../../../client-api/starter.js"
let S = new STARTER.Local()

S.start().then( info => PPK.connect("test",info) )
/*
.then( rapi => {
  let req_api = req_init( rapi, rapi.query )
  rapi.request = req_api.request
  rapi.reply = req_api.reply
  return rapi
})
*/
.then(rapi => {
  console.log("connected")

  console.log("setting query")

  rapi.query( "samba" ).done( (msg) => {
    console.log('got request using query, replying')
    rapi.reply( msg, {out_info:"de Janeiro",out_count: msg.in_alfa*3} )
  }).then( () => {
    console.log("sending request")
    rapi.request( {label: "samba", in_alfa: 25} ).done( reply => {
      console.log("request got reply",reply)
    })

  } )
  
  rapi.query( "samba10" ).done( (msg) => {
    rapi.reply( msg, msg.n*10 )
  }).then( () => {
    rapi.request( {label: "samba10", n: 11} ).done( reply => {
      console.log("samba10 reply",reply)
      //rapi.exit()
    })

  } )

})
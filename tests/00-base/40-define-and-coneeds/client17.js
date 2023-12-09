#!/usr/bin/env node

import * as PPK from "../../../client-api/client-api.js"

PPK.connect("test",undefined,true).then(rapi => {
  console.log("connected")
  
  let sum = rapi.define( "sum", rapi.js( arg => {
    return arg.a + arg.b
  }, {a:0,b:0} ) )
  // функция f(a,b) = a+b+10
  let f10 = rapi.define( "f10", sum( { a:sum({a:{ref:"a"},b:{ref:"b"}} ), b:10}) )
  rapi.exec( f10({a:5,b:2}) ).done( r => {
    console.log("5+2+10 result is",r)
  });  

})
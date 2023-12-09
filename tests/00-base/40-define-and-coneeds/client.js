#!/usr/bin/env node

import * as PPK from "../../../client-api/client-api.js"

PPK.connect("test",undefined,true).then(rapi => {
  console.log("connected")
  
  let sum = rapi.define( "sum", rapi.js( arg => {
    return arg.a + arg.b
  }, {a:0,b:0} ) )

  console.log("sum code ois",sum({a:1,b:sum({a:10,b:20})}) )
  rapi.exec( sum({a:1,b:2}) ).done( r => {
    console.log("1+2 result is",r)
  });
  rapi.exec( sum({a:1,b:sum({a:10,b:20})}) ).done( r => {
    console.log("1+(10+20) result is",r)
  });

})
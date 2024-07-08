#!/usr/bin/env node

import * as PPK from "ppk";

PPK.connect("test",undefined,true).then(rapi => {
  console.log("connected")
  rapi.msg( { label:'a', a: 5, b: 7} )
  rapi.msg( { label:'b',  b: 7 } )

})
#!/usr/bin/env -S node --experimental-fetch 
//--no-warnings

//var request = require('request');
//var fs = require('fs');
import * as fs from 'fs'

var f = process.argv[2];
let url = 'http://localhost:3333'

let stream = fs.createReadStream(f)

fetch(url, {
  method: 'POST',
  body: stream,
  compress: false
})
.catch( err => console.log( 'error',err ) )
.then((response) => {
  console.log("ok=",response.ok,response.status);
  return response.text()
})
.catch( err => console.log( 'error',err ) )
.then((data) => {
 console.log(data)
})
.catch( err => console.log( 'error',err ) )

;
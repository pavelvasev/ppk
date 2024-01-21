#!/usr/bin/env -S node
// print-vis печатает информацию из графа визуализации. для этого посылает управляющий сигнал.

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"

//import * as LIB from "./robots/lib.js"
import * as PASS from "./robots/pass.js"
import * as PASS_EACH from "./robots/pass_each.js"
//import * as REDUCE from "./robots/reduce.js"
import * as WRITE_FS from "./robots/write_fs.js"
import * as STENCIL_1D from "./robots/stencil_1d.js"
import * as PRINT from "./robots/print.js"
import * as MERGE from "./robots/merge.js"

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()
let DEBUG_WORKERS= process.env.DEBUG ? true : false

//let P = 10
let P = process.env.P ? parseInt(process.env.P) : 10
let DN = process.env.DN ? parseInt(process.env.DN) : 1000
console.log({DN})

let sys = Promise.resolve( true ) // пока тянет

sys.then( info => PPK.connect("test",info,true) ).then( rapi => {
  
    //main( rapi )
    console.log("rapi connected, waiting workers");
    
    rapi.wait_workers( P ).then( (workers) => {
      console.log("found workers", workers);
      main( rapi, workers.map( w => w.id ) )
    });
  
})

////////////////////////////////
//import * as F from "./f.js"

function range(n) {
  let arr = []
  for (let i=0; i<n; i++) arr.push(i)
  return arr
}

function main( rapi, workers ) {

  let control_cell = rapi.create_cell( "vis5/control" )

  let data_port = rapi.read_cell(`j1d/output/0`) 
  //let data_port = rangerapi.read_cell(`pass1/iter/0`,{limit:1})

  let counter = 0
  let t0  
  let first_time = true
  function tick() {
    control_cell.submit( 1 )
    data_port.next().then( value => {

      if (first_time) {
        t0 = performance.now()
        first_time = false
      }
      let t1 = performance.now()
      
      if (t1 > t0+1000)
         console.log( "FPS=",1000 * counter / (t1 - t0),"t1=",t1,"counter=",counter,"data=",value )

      counter++  

      rapi.get_payload( value.payload_info[0] ).then( data => {
        console.log("data=",data)        
      }).then( tick )
    })
  }
  
  tick()

}
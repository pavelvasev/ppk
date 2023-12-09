#!/usr/bin/env -S node
// тест локальное вычисление на ячейках - пока без параллельности

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"

let DN = process.env.DN ? parseInt(process.env.DN) : 1000
console.log({DN})

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()

let sys = S.start().then( (info) => {

  console.log("OK system started", info, S.url)

  return  S.start_workers( 1,4,4*10*1000,1,'-t 40 --gres=gpu:v100:1 -p v100' ).then( (statuses) => {
    console.log("workers started",statuses)
    return true
  }).catch( err => {
    console.log("workers error",err)
    process.exit()
  })
  
});

sys.then( info => PPK.connect("test",info) ).then( rapi => {
    console.log("rapi connected, waiting workers");
    rapi.wait_workers( 4 ).then( (workers) => {
      console.log("found workers", workers);
      main( rapi, workers.map( w => w.id ) )
    });
})

////////////////////////////////
import * as F from "./f.js"

function main( rapi, worker_ids ) {
  let n = 1001
  let data =  new Float32Array(DN)
  console.log("init data=",data)
  let prev = data
  //let prev = rapi.promises.add_data( data )
  let prev0 = prev

  console.log("spawning",n)
  console.time("compute")

  let wc = rapi.create_cell( "data" )
  wc.submit( prev )
  
  let rc = rapi.read_cell("data")
  
  function process( rc,wc,N ) {
    let d = rc.next();
    return d.then( data => {
      let res = F.f( {input:data} )
      wc.submit( res )
      if (N > 0)
        return process( rc, wc,N-1 )
      return res
    })
  }
  
  let res = process( rc, wc,1000 )
  
  res.then( result => {
    console.timeEnd("compute")
    console.log("done. prev=",result)  
  })


}
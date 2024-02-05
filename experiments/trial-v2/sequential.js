#!/usr/bin/env -S node
// последовательное вычисление

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"
import * as F from "./f.js"

let DN = F.DN
let iters = F.iters 
console.log({DN,iters})

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

function main( rapi, worker_ids ) {
  let n = iters
  let data =  new Float32Array(DN)
  let data2 =  new Float32Array(DN)
  console.log("init data=",data)
  let prev = data
  //let prev = rapi.promises.add_data( data )
  let prev0 = prev

  console.log("spawning",n)
  console.time("compute")
  
  for (let i=0; i<n; i++) {
    //console.log("spawning",i)
    let k = i;
    //let runner_id = worker_ids[ i % 4 ]
    //let runner_id = worker_ids[ 2 ]
    let runner_id = null // авто выбор
    //prev = rapi.exec( rapi.js( f, {input: rapi.reuse(prev)}), {runner_id})
    //prev = rapi.exec( rapi.js( f, {input: prev}), {runner_id})
    prev = F.f( {input:prev} )
  }

  console.timeEnd("compute")
  console.log("done. prev=",prev)
  process.exit()  
  
}
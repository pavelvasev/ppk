#!/usr/bin/env -S node
// тест локальное вычисление

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"

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
  let n = 1001
  let data =  new Float32Array(1000)
  console.log("init data=",data)
  let prev = data
  //let prev = rapi.promises.add_data( data )
  let prev0 = prev

  console.log("spawning",n)
  console.time("compute")

  let f = arg => {
       // стандартный адаптер подтянул нам все ключи которые payload_info имеют..
       let p = arg.input
       //console.log("input is",p)
       //let nx = new Float32Array( p.length )
       for (let j=0; j<p.length; j++)
         p[j] = p[j] + Math.random(1)
       //console.log("computed",p)          
       return p
    }

  for (let i=0; i<n; i++) {
    //console.log("spawning",i)
    let k = i;
    //let runner_id = worker_ids[ i % 4 ]
    //let runner_id = worker_ids[ 2 ]
    let runner_id = null // авто выбор
    //prev = rapi.exec( rapi.js( f, {input: rapi.reuse(prev)}), {runner_id})
    //prev = rapi.exec( rapi.js( f, {input: prev}), {runner_id})
    prev = f( {input:prev} )
  }

  console.timeEnd("compute")
  console.log("done. prev=",prev)
  
  
/*
  rapi.wait_promise( prev ).then( res => {
     console.timeEnd("compute")
    console.log("done!",res)
    rapi.get_data( prev ).then( p => {
      console.log(p) 
      rapi.exit()
    })
    
  })
*/  
}
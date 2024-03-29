#!/usr/bin/env -S node

// параллельная версия на модели графов задач с явным назначением задач исполнителям

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"
import * as F from "./f.js"

let P = F.P
let DN = F.DN
let iters = F.iters 
console.log({DN,P,iters})

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()

let sys = S.start().then( (info) => {

  console.log("OK system started", info, S.url)

  return  S.start_workers( 1,P,4*10*1000,1,'-t 40 --gres=gpu:v100:1 -p v100').then( (statuses) => {
    console.log("workers started",statuses)
    return true
  }).catch( err => {
    console.log("workers error",err)
    process.exit()
  })
  
});

sys.then( info => PPK.connect("test",info) ).then( rapi => {
    console.log("rapi connected, waiting workers");
    rapi.wait_workers( P ).then( (workers) => {
      console.log("found workers", workers);
      main( rapi, workers.map( w => w.id ) )
    });
})

////////////////////////////////

function main( rapi, worker_ids ) {
  let n = iters
  let data =  new Float32Array( DN / P )
  console.log("init data=",data)
  let prev = rapi.promises.add_data( {left:0, right:0, payload:[data]} )
  let p_data = []
  for (let k=0; k<P; k++) p_data.push( prev )
  // p_data - распределенная структура

  console.log("spawning",n)
  console.time("compute")

  // генерируем и запускаем граф задач
  for (let i=0; i<n; i++) {
    let p_data_next = []
    for (let k=0; k<P; k++) {    
      let runner_id = worker_ids[ k ]
      let left_block = k > 0 ? rapi.skip_payloads( p_data[k-1] ) : null
      let right_block = k < P-1 ? rapi.skip_payloads( p_data[k+1] ) : null
      // rapi.exec = добавить задачу
      // задача назначается исполнителю в ручном режиме (параметр runner_id), без централизованной балансировки
      // console.log("sub runner_id=",runner_id)
      let r = rapi.exec( rapi.js( F.f_part, { input: rapi.reuse( p_data[k] ),left_block, right_block, i, k }), {runner_id})
      p_data_next.push( r )
    }
    p_data = p_data_next
  }

  console.log("done. p_data=",p_data)

  rapi.wait_all( p_data ).then( res => {
     console.timeEnd("compute")
     console.log("all done!",res)
     rapi.get_data( p_data[0]  ).then( p => {
      console.log(p.payload[0] ) 
      rapi.exit()
      process.exit()
     })
  })
}
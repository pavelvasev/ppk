#!/usr/bin/env -S node
// тест локальное вычисление

export let f = (arg) => {
       let p = arg.input
       //console.log("input is",p)
       //let nx = new Float32Array( p.length )
       let jmax = p.length-1
       let p_left = p[0]
       let p_my   = 0
       let p_right = 0
       for (let j=1; j<jmax; j++) {
         p_my = p[j]
         p_right = p[j+1]
         p[j] = (p_left + p_right)/2 + Math.random(1)
         p_left = p_my
       }
       //p_next[j] = (p[j-1] + p[j+1])/2 + Math.random(1)
       //console.log("computed",p)
       return p
}


export let f_optimized = (arg) => {
       let p = arg.input
       //console.log("input is",p)
       //let nx = new Float32Array( p.length )
       let jmax = p.length-1

          let p_left = p[0]
          let p_my   = 0
          let p_right = p[1]
       
       for (let j=1; j<jmax; j++) {
         p_my = p_right
         p_right = p[j+1]
         p[j] = (p_left + p_right)/2 + Math.random(1)
         p_left = p_my
       }
       //p_next[j] = (p[j-1] + p[j+1])/2 + Math.random(1)
       //console.log("computed",p)
       return p
}


import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"

let DN = process.env.DN ? parseInt(process.env.DN) : 1000
let iters = process.env.ITERS ? parseInt(process.env.ITERS) : 1000*3

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
// import * as F from "./f.js"

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
  
  let t0 = performance.now()
  
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
  
    let tdiff = performance.now()-t0
    
    console.timeEnd("compute")
    
    let fps = 1000*iters / tdiff
    console.error("P=",1,"DN=",DN,"iters=",iters, "seconds=",tdiff / 1000, "final_fps=", fps, "fps_per_runner=",fps )

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
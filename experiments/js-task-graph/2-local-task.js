#!/usr/bin/env -S node
// постановка задачи на раннере

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()
let W = 1

let sys = S.start().then( (info) => {

  console.log("OK system started", info, S.url)

  return  S.start_workers( 1,W,4*10*1000,1,'-t 40 --gres=gpu:v100:1 -p v100' ).then( (statuses) => {
    console.log("workers started",statuses)
    return true
  }).catch( err => {
    console.log("workers error",err)
    process.exit()
  })
  
});

sys.then( info => PPK.connect("test",info) ).then( rapi => {
  
    console.log("rapi connected, waiting workers");
    rapi.wait_workers( W ).then( (workers) => {
      console.log("found workers", workers);
      main( rapi, workers.map( w => w.id ) )
    });
  
})

////////////////////////////////

function main( rapi, worker_ids ) {
  let n = 1001
  let data =  new Float32Array(1000)
  console.log("init data=",data)
  let prev = rapi.promises.add_data( data )
  let prev0 = prev

  console.log("spawning",n)
  console.time("compute")

  let f = arg => {
       // стандартный адаптер подтянул нам все ключи которые payload_info имеют..
       let p = arg.input
       //console.log("f input is",p)
       //let nx = new Float32Array( p.length )
       for (let j=0; j<p.length; j++)
         p[j] = p[j] + Math.random(1)
       //console.log("f computed",p)
       return p
    }
  rapi.define("step1", rapi.js(f))

/*
  for (let i=0; i<n; i++) {
    //console.log("spawning",i)
    let k = i;
    //let runner_id = worker_ids[ i % 4 ]
    //let runner_id = worker_ids[ 2 ]
    let runner_id = null // авто выбор
    prev = rapi.exec( rapi.js( f, {input: rapi.reuse(prev)}), {runner_id})
    //prev = rapi.exec( rapi.js( f, {input: prev}), {runner_id})
  }
*/

  rapi.reaction("start-iter").action( (msg, rarg, rapi) => {
    console.log("r: see start-iter msg",msg )
    if (!(msg.N > 0)) {
      console.log("N is small, exiting")
      rapi.msg({label:"finished",runner_id:msg.my_id, data: msg.data})
      return
    }
    // console.log("executing on input=",msg.data)
    // enter-iter
    let res = rapi.exec( rapi.operation("step1", {input:msg.data}, "js"), {runner_id: msg.my_id} )
    
    //rapi.exec( rapi.operation("compute", {func:rapi.operation("step1")}),{input:msg.data,runner_id: msg.my_id} )
    // можно ждать res но это получается будет задержка
    // а если ждем msg.data то это получается ждем предыдущего
    rapi.wait_promise( res ).then( r => {
      //console.log("see result!!!! r=",r,"respawning with",msg.N-1)
      rapi.msg( {label:"start-iter", N: msg.N-1, my_id: msg.my_id, data: res} ) 
    })
  })

  rapi.exec( rapi.js( (args) => {
      console.log("sending rapi msg of start-iter",args)
      rapi.msg( {label:"start-iter", N: args.N, my_id: args.my_id, data: args.data_pr[0]} ) // , prev: args.prev
  }), {arg:{N: n,my_id: worker_ids[0], data_pr: [prev]}, runner_id: worker_ids[0]})

/*
  worker_ids.forEach( runner_id => {
    rapi.exec( rapi.js( (args) => {
      console.log("sending rapi msg of start-iter",args)
      rapi.msg( {label:"start-iter", N: args.N} )
    }), {arg:{N: n}, runner_id})
  })*/

  console.log("done. prev=",prev)

  rapi.query( "finished").done( (msg) => {
    console.timeEnd("compute")
    console.log("see finished",msg)
    rapi.get_data( msg.data ).then( p => {
      console.log(p) 
      //rapi.exit()
    })
  })

/*
  rapi.wait_promise( prev ).then( res => {
    console.timeEnd("compute")
    console.log("done!",res)
    rapi.get_data( prev ).then( p => {
      console.log(p) 
      //rapi.exit()
    })    
  })
*/  
}
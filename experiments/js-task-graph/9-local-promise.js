#!/usr/bin/env -S node
// 9 - локальные промисы
// 7 - граф в памяти
// 6 - меняем способ генерации итерации - пробуем через задачу
// 4 - ввод канало в промисы
// 3 - enter_iter вынесена явно
// 2 - постановка задачи на раннере

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

  let next_iter = arg => {

    let f = arg => {
         //console.log("f-call......")
         // стандартный адаптер подтянул нам все ключи которые payload_info имеют..
         let p = arg.input
         //console.log("f input is",p)
         //let nx = new Float32Array( p.length )
         for (let j=0; j<p.length; j++)
           p[j] = p[j] + Math.random(1)
         //console.log("f computed",p)
         return p
    }

    function step(my_data,N) {
      if (N > 0) {
        Promise.resolve(my_data).then( d => {     
           return f({input:d})
        }).then( (new_data) => step(new_data,N-1) )
      } else {
        console.timeEnd("iter-dur")
        let r = rapi.add_data( my_data )
        rapi.msg({label:"finished", data: r})
      }
    }    

    console.time("iter-dur")
    step( arg.data, arg.N)

    //console.log("............ next_iter finished! N=",arg.N)
  }
  rapi.define("next_iter", rapi.js(next_iter))

  ////////////////////////////////////

  console.time("compute")

  //rapi.exec( rapi.operation( "next_iter",{},"js"), {arg: {N: n, my_id: worker_ids[0], data: rapi.skip_payloads(prev)}, runner_id: worker_ids[0]})
  rapi.exec( rapi.operation( "next_iter",{},"js"), {arg: {N: n, my_id: worker_ids[0], data: prev}, runner_id: worker_ids[0]})

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
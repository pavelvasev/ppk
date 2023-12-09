#!/usr/bin/env -S node
// тест запуска конкретного раннера

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
    /*
    rapi.shared("runners-list").subscribe( l => {
      console.log("see runners-list",l)
    })
    */
    // , runners_list=",rapi.runners_list)
    //rapi.runners_list = msg.list;
    // rapi.exit()
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
       //console.log("input is",p)
       let nx = new Float32Array( p.length )
       for (let j=0; j<p.length; j++)
         nx[j] = p[j]+1
       //console.log("computed",nx)
            
       return nx

       // т.е. там адаптер не тупой, понял что типизированный массив и сам его просабмитил
       // return rapi.payload( p )
       //   но тогда почему там resolved_promise?
       // return rapi.submit_payload( p ) да и все..
       // ну т.е. возвращаем простой объект данных. а все что надо было просамбитить - вот, сабмитьте
       // ну глянем еще, с учетом оптимизации разбивки на 2 шага сабмита результатов тасков..
    }

  for (let i=0; i<n; i++) {
    //console.log("spawning",i)
    let k = i;
    //prev = rapi.exec( rapi.js( f, {input:prev0}) )
    let runner_id = worker_ids[ i % 4 ]
    //let runner_id = worker_ids[ 2 ]
    prev = rapi.exec( rapi.js( f, {input:prev}), {runner_id})
  }

  console.log("done. prev=",prev)

  rapi.wait_promise( prev ).then( res => {
     console.timeEnd("compute")
    console.log("done!",res)
    rapi.get_data( prev ).then( p => {
      console.log(p) 
      rapi.exit()
    })
    
  })
}
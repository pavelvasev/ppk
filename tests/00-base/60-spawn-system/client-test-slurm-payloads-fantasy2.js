#!/usr/bin/env -S node
// многопоточный счет
// наблюдается проблема с большим числом отправляемых пакетов

import * as PPK from "../../../client-api/client-api.js"
import * as STARTER from "../../../client-api/starter.js"

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()
// так-то это не Slurm а просто удаленный хост.
// а вот для воркеров у него уже внутри - будет слурм.
// но воркеры это как бы частная задача.. ех

S.start().then( (info) => {

  console.log("OK system started", info, S.url)

  S.start_workers( 1,2,4*10*1000,1,'-t 40 --gres=gpu:v100:1 -p v100' ).then( (statuses) => {
    console.log("workers started",statuses)
  }).catch( err => {
    console.log("workers error",err)
    process.exit()
  })

// PPK_URL=ws://127.0.0.1:10000 ./client-test-spawn-3.js
//let url=process.env.PPK_URL || `local::{"workers":5,"ram":1000,"gpu":200}`

PPK.connect("test",info).then(rapi => {
  console.log("connected")

  let n = 1000
  let prev_1 = rapi.promises.add_data( new Float32Array(10) )
  let k = 100
  let prev = (new Array(k)).fill( prev_1 )

  console.log("spawning",n)

  let f = arg => {
       // стандартный адаптер подтянул нам все ключи которые payload_info имеют..
       let p = arg.i
       let nx = new Float32Array( p.length )
       for (let j=0; j<p.length; j++) 
         nx[j] = p[j]+1
       return nx
       // т.е. там адаптер не тупой, понял что типизированный массив и сам его просабмитил
       // return rapi.payload( p )
       //   но тогда почему там resolved_promise?
       // return rapi.submit_payload( p ) да и все..
       // ну т.е. возвращаем простой объект данных. а все что надо было просамбитить - вот, сабмитьте
       // ну глянем еще, с учетом оптимизации разбивки на 2 шага сабмита результатов тасков..
  }

  function spawn( cnt ) {
     if (cnt <= 0) return
     for (let j=0; j<k; j++)
       prev[j] = rapi.exec( rapi.js( f, {i:prev[j]}) )
     setTimeout( () => spawn( cnt-1 ), 10 )
  }

  /*
  for (let i=0; i<n; i++) {
    //console.log("spawning",i)
    for (let j=0; j<k; j++)
      prev[j] = rapi.exec( rapi.js( f, {i:prev[j]}) )
  }
  */

  spawn( n )

  console.log("OK done spawning")
  setTimeout( () => rapi.exit(), 10000 )

/*
  let all = rapi.when_all( prev )

  console.log("waiting all result. all=",all,"prev=",prev.length)
  rapi.wait_promise( all ).then( res => {
    console.log("done!",res, "loading res[0]=",res[0])
    rapi.exit()
  
    //rapi.get_one_payload( res[0] ).then( p => {
    //  console.log(p) 
    //  rapi.exit()
    //})
    
  })
*/  

})

})
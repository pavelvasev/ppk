#!/usr/bin/env node
// тестируем пейдлажы

import * as PPK from "../../../client-api/client-api.js"
import * as STARTER from "../../../client-api/starter.js"

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()
// так-то это не Slurm а просто удаленный хост.
// а вот для воркеров у него уже внутри - будет слурм.
// но воркеры это как бы частная задача.. ех

S.start().then( (info) => {

  console.log("OK system started", info, S.url)

  S.start_workers( 1,1,4*10*1000,1,'-t 40 --gres=gpu:v100:1 -p v100' ).then( (statuses) => {
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
  let prev = rapi.promises.add_data( new Float32Array(1000) )

  console.log("spawning",n)
  console.time("compute")

  let f = arg => {
       // стандартный адаптер подтянул нам все ключи которые payload_info имеют..
       let p = arg.input
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

  for (let i=0; i<n; i++) {
    //console.log("spawning",i)
    let k = i;
    prev = rapi.exec( rapi.js( f, {input:prev}) )
  }
  
  console.log("waiting promise",prev)
  rapi.wait_promise( prev ).then( res => {
     console.timeEnd("compute")
    console.log("done!",res)
    rapi.get_one_payload( res ).then( p => {
      console.log(p) 
      rapi.exit()
    })
  })

})

})
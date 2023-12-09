#!/usr/bin/env -S node
// многопоточный счет
// решаем проблему большого числа пакетов - созданием деревьев

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()
// так-то это не Slurm а просто удаленный хост.
// а вот для воркеров у него уже внутри - будет слурм.
// но воркеры это как бы частная задача.. ех

S.start().then( (info) => {

  console.log("OK system started", info, S.url)

  S.start_workers( 1,4,4*10*1000,1,'-t 40 --gres=gpu:v100:1 -p v100' ).then( (statuses) => {
    console.log("workers started",statuses)
  }).catch( err => {
    console.log("workers error",err)
    process.exit()
  })

// PPK_URL=ws://127.0.0.1:10000 ./client-test-spawn-3.js
//let url=process.env.PPK_URL || `local::{"workers":5,"ram":1000,"gpu":200}`

PPK.connect("test",info).then(rapi => {
  console.log("connected")

  let n = 100
  let prev_1 = rapi.promises.add_data( new Float32Array(1000) )
  let k = 1000
  let prev = (new Array(k)).fill( prev_1 )

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

  console.time("COMPUTE")

  //console.log("generating n=",n)
  console.log("spawning k=",k)
  for (let j=0; j<k; j++) {
    let node = prev_1
      for (let i=0; i<n; i++) {
          node = rapi.exec_node( rapi.js( f, {i:node}), {limits: {ram:4*1000}, id_prefix:`[j=${j}][i=${i}]`} )
      }
    prev[j] = rapi.exec( node )
  }

  console.log("OK done spawning")

  let all = rapi.when_all( prev )

  console.log("waiting all result. all=",all,"prev=",prev.length)
  rapi.wait_promise( all ).then( res => {
    console.log("done! loading res=",res)
    console.timeEnd("COMPUTE")
    /*
    rapi.get_payload( [ res[0], res[ res.length-1] ] ).then( data => {
      console.log(data)
      rapi.exit()
    })
    */
    

    rapi.get_one_payload( res[0].payload_info[0] ).then( p => {
      console.log(p) 
      rapi.exit()
    })
    
  })

})

})
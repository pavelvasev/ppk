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

  console.log("OK Slurm started", info, S.url)

  S.start_workers( 1,4,4*10*1000,1,'','-t 40 --gres=gpu:v100:1 -p v100' ).then( (statuses) => {
    console.log("Slurm workers started",statuses)
  }).catch( err => {
    console.log("workers error",err)
    process.exit()
  })

// PPK_URL=ws://127.0.0.1:10000 ./client-test-spawn-3.js
//let url=process.env.PPK_URL || `local::{"workers":5,"ram":1000,"gpu":200}`

PPK.connect("test",info,true).then(rapi => {
  console.log("connected")

  let n = 10
  let prev = 0
  for (let i=0; i<n; i++) {
    console.log("spawning",i)
    let k = i;
    prev = rapi.exec( rapi.js( arg => {
      let res
      console.log("exec started, arg.i is",arg.i)
      if (arg.i == 0)
        return {payload:[new Float32Array(100)]}
      else
      return rapi.get_one_payload( arg.i.payload_info[0] ).then( p => {
        console.log("payload loaded",p)
        for (let j=0; j<p.length; j++) 
          p[j] = p[j]+1
        return {payload:[p]}
      })
    }, {i:prev}) )
  }

  prev.done( res => {
    console.log("done!",res)
    rapi.get_one_payload( res.payload_info[0] ).then( p => {
      console.log(p) 
      rapi.exit()
    })
    
  })

})

})
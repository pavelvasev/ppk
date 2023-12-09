#!/usr/bin/env node
// тестируем много задач

import * as PPK from "../../../client-api/client-api.js"
import * as SLURM from "../../../client-api/starter.js"

let S = new SLURM.Slurm( "u1321@umt.imm.uran.ru" )
// так-то это не Slurm а просто удаленный хост.
// а вот для воркеров у него уже внутри - будет слурм.
// но воркеры это как бы частная задача.. ех

S.start().then( (info) => {

  console.log("OK Slurm started", info, S.url)

  S.start_workers( 2,4,4*10*1000,1,'-t 40 --gres=gpu:v100:1 -p v100' ).then( (statuses) => {
    console.log("Slurm workers started",statuses)
  }).catch( err => {
    console.log("workers error",err)
    process.exit()
  })

// PPK_URL=ws://127.0.0.1:10000 ./client-test-spawn-3.js
//let url=process.env.PPK_URL || `local::{"workers":5,"ram":1000,"gpu":200}`

PPK.connect("test",info).then(rapi => {
  console.log("connected")

  let n = 10
  let prev = 0
  for (let i=0; i<n; i++) {
    console.log("spawning",i)
    let k = i;
    prev = rapi.exec( rapi.js( arg => {
      return arg.i+1
    }, {i:prev}) )
  }

  prev.done( res => {
    console.log("done!",res)
    rapi.exit()
  })

})

})
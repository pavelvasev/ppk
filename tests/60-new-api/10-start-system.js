#!/usr/bin/env -S node
// тест получения списка раннеров

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
    rapi.wait_workers( 4 ).then( (worker_ids) => {
      console.log("found workers", worker_ids);
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
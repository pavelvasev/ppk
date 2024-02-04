#!/usr/bin/env -S node

/* ручное распараллеливание

   расчетная сетка разбивается на P блоков и запускается P исполнителей

   на каждом исполнителе запускается процесс,
   который считывает данные из каналов и записывает данные в канал
   и эти каналы закольцовываются.

   в каналы записываются только граничные значения. 
   блоки данных хранятся в памяти исполнителей и не передаются
*/

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"
import * as F from "./f.js"

let DN = process.env.DN ? parseInt(process.env.DN) : F.DN
console.log({DN})

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()
let P = process.env.P ? parseInt(process.env.P) : F.P

let sys = S.start().then( (info) => {

  console.log("OK system started", info, S.url)

  return  S.start_workers( 1,P,4*10*1000,1,'-t 40 --gres=gpu:v100:1 -p v100').then( (statuses) => {
    console.log("workers started",statuses)
    return true
  }).catch( err => {
    console.log("workers error",err)
    process.exit()
  })
  
});

sys.then( info => PPK.connect("test",info) ).then( rapi => {
  
    console.log("rapi connected, waiting workers");
    rapi.wait_workers( P ).then( (workers) => {
      console.log("found workers", workers);
      main( rapi, workers.map( w => w.id ) )
    });
  
})

////////////////////////////////

function main( rapi, worker_ids ) {
  let n = 1001 //*1000*1000
  let data =  new Float32Array( DN / P )
  console.log("init data=",data)
  let prev = rapi.promises.add_data( {left:0, right:0, payload:[data]} )
  let p_data = []
  for (let k=0; k<P; k++) p_data.push( prev )

  console.log("spawning",n)

  // arg: data, N, P - кол-во кусочков, k - номер кусочка
  let next_iter = arg => {

    // открываем каналы на чтение
    let left_cell = arg.k > 0 ? rapi.read_cell(`${arg.k-1}-data`) : null
    let right_cell = arg.k < arg.P-1 ? rapi.read_cell(`${arg.k+1}-data`) : null
    // открываем канал на запись
    // в каналы будем записывать только граничные значения
    let my_cell = rapi.create_cell(`${arg.k}-data`)
    my_cell.submit( [0,0] )

    function step(my_data, N) 
    {
      if (N > 0) {        
        Promise.all([my_data, left_cell ? left_cell.next() : null, right_cell ? right_cell.next() : null] ).then( darr => {
           
           let params = {input:darr[0]}
           if (darr[1]) params.left_block = {right: darr[1][1]}
           if (darr[2]) params.right_block= {left: darr[2][0]} 
           
           let res = arg.f_part( params )
           my_cell.submit( [res.left, res.right] )
           return res
        }).then( (new_data) => step(new_data,N-1) )
      } else {
        console.timeEnd("iter-dur")
        let r = rapi.add_data( my_data )
        rapi.msg({label:"finished", data: r, k: arg.k})
      }
    }

    console.time("iter-dur")    
    step( arg.data, arg.N)
    
  }
  rapi.define("next_iter", rapi.js(next_iter))

  ////////////////////////////////////

  console.time("compute")

  for (let k=0; k<P; k++) 
    rapi.exec( rapi.operation( "next_iter",{},"js"), 
      {arg: {k, P, N: n, my_id: worker_ids[k], data: prev, f_part: rapi.compile_js(F.f_part)}, 
      runner_id: worker_ids[k]})

  console.log("done. prev=",prev)

  rapi.query( "finished").done( (msg) => {
    console.timeEnd("compute")
    console.log("see finished",msg)
    if (msg.k == 0)
    rapi.get_data( msg.data ).then( p => {
      console.log("k=",msg.k,"data=",p) 
      //rapi.exit()
      process.exit()
    })
  })

}
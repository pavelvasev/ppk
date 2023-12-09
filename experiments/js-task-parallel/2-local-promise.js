#!/usr/bin/env -S node
// 2 - параллельная версия на промисах внутри воркеров + каналы-ячейки compute: 243.832ms

let DN = process.env.DN ? parseInt(process.env.DN) : 1000
console.log({DN})

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()
let P = 4

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
//import * as F from "./f.js"

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

    let f_part = (arg) => {

       //console.log("f-part arg=",arg)
       //console.log("processing")

       let p = arg.input.payload[0]
       //console.log("input is",p)
       //let nx = new Float32Array( p.length )
       let jmax = p.length-1
       p[ 0 ] = arg.left_block ? arg.left_block.right : 0
       p[ p.length-1 ] = arg.right_block ? arg.right_block.left : 0
       let p_left = p[0]
       let p_my   = 0
       let p_right = 0
       for (let j=1; j<jmax; j++) {
         p_my = p[j]
         p_right = p[j+1]
         p[j] = (p_left + p_right)/2 + Math.random(1)
         p_left = p_my
       }
       //p_next[j] = (p[j-1] + p[j+1])/2 + Math.random(1)
       //console.log("computed",p)
       return {payload:[p],left:p[1], right:p[p.length-2]}
    }

    let left_cell = arg.k > 0 ? rapi.read_cell(`${arg.k-1}-data`) : null
    let right_cell = arg.k < arg.P-1 ? rapi.read_cell(`${arg.k+1}-data`) : null
    let my_cell = rapi.create_cell(`${arg.k}-data`)
    my_cell.submit( [0,0] )

    function step(my_data, N) 
    {
      if (N > 0) {
        // console.time("wait-data")
        Promise.all([my_data, left_cell ? left_cell.next() : null, right_cell ? right_cell.next() : null] ).then( darr => {
           // console.timeEnd("wait-data")
           //console.log("darr=",darr)
           let params = {input:darr[0]}
           if (darr[1]) params.left_block = {right: darr[1][1]}
           if (darr[2]) params.right_block= {left: darr[2][0]} 
           //console.log("params=",params)
           let res = f_part( params )
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

    //console.log("............ next_iter finished! N=",arg.N)
  }
  rapi.define("next_iter", rapi.js(next_iter))

  ////////////////////////////////////

  console.time("compute")

  for (let k=0; k<P; k++) 
    rapi.exec( rapi.operation( "next_iter",{},"js"), {arg: {k, P, N: n, my_id: worker_ids[k], data: prev}, runner_id: worker_ids[k]})

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
    if (msg.k == 0)
    rapi.get_data( msg.data ).then( p => {
      console.log("k=",msg.k,"data=",p) 
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
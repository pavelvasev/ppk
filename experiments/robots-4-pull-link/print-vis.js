#!/usr/bin/env -S node
// print-vis печатает информацию из графа визуализации. для этого посылает управляющий сигнал.

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"

import * as LINK from "./robots/link.js"
import * as LINK_PULL from "./robots/link_pull.js"

import * as PASS from "./robots/pass.js"
import * as PASS_EACH from "./robots/pass_each.js"
//import * as REDUCE from "./robots/reduce.js"
import * as WRITE_FS from "./robots/write_fs.js"
import * as STENCIL_1D from "./robots/stencil_1d.js"
import * as PRINT from "./robots/print.js"
import * as MERGE from "./robots/merge.js"
import * as DOWNSAMPLE from "./robots/downsample.js"
import * as JOIN_1D from "./robots/join_1d_masked.js"

//import * as COMP from

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()
let DEBUG_WORKERS= process.env.DEBUG ? true : false

PPK.mk_console_verbose( process.env.VERBOSE )

//let P = 10
let P = process.env.P ? parseInt(process.env.P) : 10
let DN = process.env.DN ? parseInt(process.env.DN) : 1000
console.log({DN})

let sys = Promise.resolve( true ) // пока тянет

sys.then( info => PPK.connect("test",info, !!process.env.VERBOSE ) ).then( rapi => {
  
    //main( rapi )
    console.log("rapi connected, waiting workers");
    
    rapi.wait_workers( P ).then( (workers) => {
      console.log("found workers", workers);
      main( rapi, workers.map( w => w.id ) )
    });
  
})

////////////////////////////////
//import * as F from "./f.js"

function range(n) {
  let arr = []
  for (let i=0; i<n; i++) arr.push(i)
  return arr
}

// робот - встроенный представитель визуализации
// todo id это параметр вызова
function vis1( rapi, id, worker_ids ) {
  //let visr = VIS3.robot( rapi, "vis1", worker_ids )

  let target_points = 1000
  let downsample_coef = Math.ceil( DN / target_points )
  let downsample = DOWNSAMPLE.robot( rapi, id+"/downsample1", worker_ids,downsample_coef )

  let joinr = JOIN_1D.robot( rapi, id+"/j1d", worker_ids )

  //LINK.create( rapi, visr.side_output, downsample.input )
  LINK.create( rapi, downsample.output, joinr.input )

  // теперь надо что когда joinr выдал свой результат, чтобы
  // был тыркнут порт main_continue
  /*

  let cont = CONT.robot( rapi, "cont", worker_ids )
  LINK.create( rapi, visr.input, cont.input )
  LINK.create( rapi, cont.output, visr.main_continue )
  //rapi.create_link( joinr.output[0].id, visr2.control[0].id )
  // можем так. тк.. там 1-размерные
  LINK.create( rapi, joinr.output, cont.control )
  */

  //return visr
  return { input: downsample.input, output: joinr.output }
}

function main( rapi, worker_ids ) {
  rapi.shared("compute1/output").subscribe( vals => {
    console.log("compute1/output vals=",vals)
    let calc_output = vals[0]
    console.log("main: got calc_output=",calc_output)
    if (calc_output)
        main_2( rapi, worker_ids, calc_output)
  })  
}

function main_2( rapi, worker_ids, calc_output ) {

  let visr = vis1( rapi, "vis1", worker_ids )
  console.log('connecting via pull',calc_output, visr.input)
  let lp = LINK_PULL.create( rapi, calc_output, visr.input, worker_ids )

  let control_cell = rapi.create_cell( lp.control[0] )
  let data_port = rapi.read_cell( visr.output[0] ) 

  console.log("lp.control=",lp.control)
  console.log("visr.output=",visr.output)
  //let data_port = rangerapi.read_cell(`pass1/iter/0`,{limit:1})

  // idea напрашивается печатающий робот. который печатает ну ячейку например
  // или там даже порт. хотя пока тут тонкости - надо запросы посылать.

  let counter = 0
  let t0  
  let first_time = true
  function tick() {
    // idea напрашивается запрос.. request...
    // его кстати может обрабатывать и сам линк (своим каким-то роботом)
    control_cell.submit( 22 )
    data_port.next().then( value => {
      console.log("data port got next... value=",value)

      if (first_time) {
        t0 = performance.now()
        first_time = false
      }
      let t1 = performance.now()
      
      if (t1 > t0+1000)
         console.log( "FPS=",1000 * counter / (t1 - t0),"t1=",t1,"counter=",counter,"data=",value )

      counter++ 

      rapi.get_payload( value.payload_info[0] ).then( data => {
        console.log("data=",data)        
      }).then( tick )
    })
  }
  
  tick()

}
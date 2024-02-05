#!/usr/bin/env -S node

// abils-2 формирует возможности - в виде функции которую вызывает основная программа.

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

////////////////////////////////
//import * as F from "./f.js"

//let P = process.env.P ? parseInt(process.env.P) : 10
let DN = process.env.DN ? parseInt(process.env.DN) : 1000000
//console.log({DN})

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

// calc_output - порт выхода счетной части
export function setup_visuals( rapi, worker_ids, calc_output ) {

  rapi.shared("abilities").submit({title:"График 1",msg:{label:"start_process",code:"gr1",target:"abils"}})

  rapi.query("start_process").done( val => {
    console.log("see msg for start_process! val=",val)
    rapi.start( val.code, val.arg, val.target)
  })

  let procs = rapi.shared_list_reader("abils")
  procs.added.subscribe( val => {
    //console.log("see process request",val)
    let {code,arg} = val.value.arg // чето перебор
    console.log("see process request",val,{code,arg})

    if (code == "gr1") {
      let r = main_3( rapi, worker_ids, calc_output )
    }
  })

  procs.deleted.subscribe( val => {
    console.log("see procs deleted",val)
  })

}

function main_3( rapi, worker_ids, calc_output ) {

  //////////////////////////// график

  rapi.shared("gr_view").submit({type:"gr",id:"gr1id",params:{sx: 10, sy: 2000}})
  let gr1id = rapi.open_cell("gr1id/data")
  let gr1id_p = rapi.create_cell("gr1id/params")

  //////////////////////////// граф визуализации

  let visr = vis1( rapi, "vis1", worker_ids )
  console.log('connecting via pull',calc_output, visr.input)
  let lp = LINK_PULL.create( rapi, calc_output, visr.input, worker_ids )

  //////////////////////////// связь графика и графа визуализации
  rapi.create_link( visr.output[0], "gr1id/data" )
  rapi.create_link( "gr1id/updated", lp.control[0] )
  console.log("visr.output[0]=",visr.output[0])

  //////////////////////////// начальный запрос

  let control_cell = rapi.create_cell( lp.control[0] )
  console.log("submitting to control_cell",lp.control[0])
  control_cell.submit( 22 )
  //let data_port = rapi.read_cell( visr.output[0] ) 
  let data_port = rapi.read_cell( "gr1id/data" )

  function tick() {
    console.log("waiting data port..",data_port.id)
    data_port.next().then( value => {
      console.log("data port got next... value=",value,"from data_port.id=",data_port.id)
    })
  }
  tick()

}
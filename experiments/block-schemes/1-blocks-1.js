#!/usr/bin/env -S node
// 1 - рефакторинг functionware-кодов

// далее сильное упрощение по ссылкам на структуры данных. 
// считается что массив упрощенный.

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()
let DEBUG_WORKERS= process.env.DEBUG ? true : false

let P = 4
let DN = process.env.DN ? parseInt(process.env.DN) : 1000
console.log({DN})

let sys = S.start().then( (info) => {

  console.log("OK system started", info, S.url)

  return  S.start_workers( 1,P,4*10*1000,1,'-t 40 --gres=gpu:v100:1 -p v100',DEBUG_WORKERS ).then( (statuses) => {
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
import * as F from "./lib.js"

function main( rapi, worker_ids ) {
  let n = 1001
  let data =  new Float32Array( DN / P )
  /*
  console.log("init data=",data)
  let prev = rapi.promises.add_data( {left:0, right:0, payload:[data]} )
  console.log("prev=",prev)
  let p_data = []
  for (let k=0; k<P; k++) p_data.push( prev )
  */
  // p_data - распределенная структура

  console.log("spawning",n)


  ////////////////////////////////////

//  rapi.define("step1", rapi.js(F.f_part))
//  rapi.define("step_div", rapi.js(F.f_part_div))


  


  //console.log("graph=",JSON.stringify(iter_graph,null," "))

  // это у нас загрузка начальных данных..
  // кстати как-то бы создать на раннерах эти каналы
  // а им уже послать..
  //let init_data = rapi.submit_payload( [data] )
  let d = rapi.add_data( {left:0, right:0,payload:[data]} )
  let p_data = []
  for (let k=0; k<P; k++) {
    p_data.push(d)
  }

////////////////////////////////////////////

// старый случай 1 функции
//  let res = f_1d_borders( ctx, (me,left,right) => (left + right)/2 + Math.random(1) ) ( p_data )


  /// все что было выше это либа. а теперь работа
  // делаем верхнюю итерацию длины 1 т.к. особенности запуска контекста

  let ctx = F.create_ctx( rapi, worker_ids)
  let cres = F.iteration( ctx, 1, p_data, (ctx, input) => {
    /////////////////// формируем граф вычислений итерации

    //let f1 = f_1d_borders( ctx, (me,left,right) => (left + right)/2 + Math.random(1) )
    //let res =  f1( input )

/*
    let f1 = f_1d_borders( ctx, (me,left,right) => (left + right)/2 + Math.random(1) )
    let f2 = f_1d( ctx, x => x * 0.5)

    let res1 = f1( input )
    let res2 = f1( res1 )
    let res =  f2( res2 )

    res = iteration( ctx, 2, input, (ctx,input) => {
      return f_1d( ctx, x => x * 1.1)( input )
    })    
*/  

    let res = F.iteration( ctx, n, input, (ctx,input) => {
      let f1 = F.f_1d_borders( ctx, (me,left,right) => (left + right)/2 + Math.random(1) )
      return f1( f1( input ) )
      //return f_1d( ctx, x => x * 1.1)( input )      
    })

    let f2 = F.f_1d( ctx, x => x * 0.5)

    res = f2( res )

    res = F.f_map_blocks( ctx, (args) => {
      //console.log('STEP got block',args);
      return args.input })( res )


    // фишка что мы тут не делаем запуск итераций, а только описываем..
    // потому что тут мы уже будем внутри запуска и поэтому
    // не понесем доп. накладных расходов

    return res
  } )

  //let f2 = f_1d( ctx, x => x * 0.5)
  //let f2_result = f2( cres )
  //console.log("f2_result=",f2_result)

  let cres2 = F.start_ctx( ctx )

  console.log({cres2})

  console.time("compute")

  rapi.wait_promise( rapi.when_all( cres2 ) ).then( computed => {
     console.timeEnd("compute")
     //console.log("computed=",computed )

     rapi.get_payloads( computed[0].payload_info ).then( data_r => {
          console.log(data_r)
     })

/*
     let cell = rapi.read_cell( computed[0].id )
      console.log("reading cell ",cell.id)
      cell.next().then( res => {
        rapi.get_payloads( res.payload_info ).then( data_r => {
          console.log(data_r)
        })        
      })
*/      
  })

}
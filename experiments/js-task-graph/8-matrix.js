#!/usr/bin/env -S node
// 8 - граф в памяти созданный централизованно
// 7 - граф в памяти
// 6 - меняем способ генерации итерации - пробуем через задачу
// 4 - ввод канало в промисы
// 3 - enter_iter вынесена явно
// 2 - постановка задачи на раннере

// далее сильное прощение по ссылкам на структуры данных. 
// считается что массив упрощенный.

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()
let W = 1

let sys = S.start().then( (info) => {

  console.log("OK system started", info, S.url)

  return  S.start_workers( 1,W,4*10*1000,1,'-t 40 --gres=gpu:v100:1 -p v100' ).then( (statuses) => {
    console.log("workers started",statuses)
    return true
  }).catch( err => {
    console.log("workers error",err)
    process.exit()
  })
  
});

sys.then( info => PPK.connect("test",info) ).then( rapi => {
  
    console.log("rapi connected, waiting workers");
    rapi.wait_workers( W ).then( (workers) => {
      console.log("found workers", workers);
      main( rapi, workers.map( w => w.id ) )
    });
  
})

////////////////////////////////

function main( rapi, worker_ids ) {
  let n = 1001
  let data =  new Float32Array(1000)
  console.log("init data=",data)
  let prev = rapi.promises.add_data( data )
  let prev0 = prev

  console.log("spawning",n)
  

  let f = arg => {
       //console.log("f-call......")
       // стандартный адаптер подтянул нам все ключи которые payload_info имеют..
       let p = arg.input
       //console.log("f input is",p)
       //let nx = new Float32Array( p.length )
       for (let j=0; j<p.length; j++)
         p[j] = p[j] + Math.random(1)
       //console.log("f computed",p)
       return p
    }
  rapi.define("step1", rapi.js(f))

  let next_iter = arg => {

    //console.log("............ hello from next_iter! N=",arg.N)

    function get_iter_tasks(data_arr,runner_id) {
      //console.log("get-iter-tasks data=",data_arr)
      //console.log("arg.iter_graph=",arg.iter_graph)
      let tasks = arg.iter_graph[ runner_id ]
      //console.log("get-iter-tasks tasks=",tasks)
      return tasks.map( t => {
        t = {...t}
        t.arg = {...t.arg}
        for (let name in t.arg) {
          let val = t.arg[name]
          if (val?.link) {
            //console.log("found link! replacing with index",val.index,data_arr[val.index])
            t.arg[name] = data_arr[val.index]
          }
        }
        return t
      })
    }

    function submit_tasks( tasks, runner_id) {
      return tasks.map( t => rapi.exec( t, {runner_id, channel_id: runner_id}  ) )
    }

    function enter_iter(data_arr,runner_id) {
      let tasks = get_iter_tasks( data_arr, runner_id )
      //console.log("TTTT",tasks)
      let submitted = submit_tasks( tasks, runner_id )
      return submitted
    }

    let r = enter_iter( arg.data_pr, arg.my_id )

    //return !!!
    if (arg.N > 0) 
      rapi.exec( rapi.operation("next_iter", 
                 {data_waiting:rapi.skip_payloads(r[0]), data_pr:r, 
                  N: (arg.N-1), my_id: arg.my_id,iter_graph: arg.iter_graph }, "js"), 
                 {runner_id: arg.my_id, channel_id: arg.my_id} )
    else {
      console.log("sending finished!")
      rapi.msg({label:"finished",runner_id:arg.my_id, data: r[0]})
    }

    //console.log("............ next_iter finished! N=",arg.N)
  }
  rapi.define("next_iter", rapi.js(next_iter))

  ////////////////////////////////////

  console.time("compute")

  // граф одной итерации. созданный глобально.
  // ну пусть предположим сразу в индексированной форме
  // ну и на вход пусть идет структура какая-то - возможно кстати сложная
  // но смысл в том что мы должны уметь построить аналогичную структуру по графу как-то..
  // ну пусть пока тупенько.. а потом каналы будем прикручивать
  // но кстати мб тут функцию можно приделать..
  function iter_step_graph(data_arr) {
    //let res = rapi.operation("step1", {input:data}, {lang_env:"js",runner_id: worker_ids[0]})
    let res = rapi.operation("step1", {input:data_arr[0]}, "js")
    //return [res]
    // тут можно приделать функцию конвертации будет
    // цель выдать граф в форме worker_id: [arr-of-tasks]
    let graph = {}
    graph[ worker_ids[0] ] = [res]
    return graph;
    //return { worker_ids[0]: [res] }
  }

  let iter_graph = iter_step_graph( [{link: true, index: 0}] )

  //console.log("graph=",iter_graph)

  //rapi.exec( rapi.operation( "next_iter",{},"js"), {arg: {N: n, my_id: worker_ids[0], data: rapi.skip_payloads(prev)}, runner_id: worker_ids[0]})
  rapi.exec( rapi.operation( "next_iter",{},"js"), {arg: {N: n, my_id: worker_ids[0], data_pr: [prev], iter_graph},  runner_id: worker_ids[0]})

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
    rapi.get_data( msg.data ).then( p => {
      console.log(p) 
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
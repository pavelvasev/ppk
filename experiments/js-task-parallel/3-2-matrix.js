#!/usr/bin/env -S node
// 3 - матричный граф, параллельная версия

// далее сильное прощение по ссылкам на структуры данных. 
// считается что массив упрощенный.

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()

let P = 4
let DN = 1000

let sys = S.start().then( (info) => {

  console.log("OK system started", info, S.url)

  return  S.start_workers( 1,P,4*10*1000,1,'-t 40 --gres=gpu:v100:1 -p v100',true ).then( (statuses) => {
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
import * as F from "./f.js"

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

  let next_iter = arg => {

    //console.log("............ hello from next_iter! N=",arg.N)

    function get_iter_tasks(data_arr,runner_id) {
      //console.log("get-iter-tasks data=",data_arr)
      //console.log("arg.iter_graph=",arg.iter_graph)
      let tasks = arg.iter_graph[ runner_id ]
      //console.log("get-iter-tasks tasks=",tasks)
      return tasks
    }

    function submit_tasks( tasks, runner_id) {
      return tasks.map( t => rapi.exec( t, {runner_id, channel_id: runner_id, cell: t.opts.cell }  ) )
    }

    function enter_iter(data_arr,runner_id) {
      let tasks = get_iter_tasks( data_arr, runner_id )
      //console.log("TTTT",tasks)
      let submitted = submit_tasks( tasks, runner_id )
      return submitted
    }

    let r = enter_iter( arg.p_data, arg.my_id )

    //return !!!
    if (arg.N > 0) 
      rapi.exec( rapi.operation("next_iter", 
                 {data_waiting:rapi.skip_payloads(r[0]), data_pr:r, 
                  k:arg.k,
                  N: (arg.N-1), my_id: arg.my_id,iter_graph: arg.iter_graph }, {lang_env:"js"}), 
                 {runner_id: arg.my_id, channel_id: arg.my_id} )
    else {
      console.log("sending finished!")
      //let r = rapi.add_data( my_data )
      rapi.msg({label:"finished",runner_id:arg.my_id, data: r[0], k: arg.k })
    }

    //console.log("............ next_iter finished! N=",arg.N)
  }
  rapi.define("next_iter", rapi.js(next_iter))

  ////////////////////////////////////

  rapi.define("step1", rapi.js(F.f_part))

  console.time("compute")

  // граф одной итерации. созданный глобально.
  // data_arr - данные предыдущей итерации
  function iter_step_graph(data_arr,data_arr_next) {
    //let res = rapi.operation("step1", {input:data}, {lang_env:"js",runner_id: worker_ids[0]})
    let graph = {}
    for (let k=0; k<P; k++) {
      let left_block = k > 0 ? rapi.skip_payloads( data_arr(k-1) ) : null
      let right_block = k < P-1 ? rapi.skip_payloads( data_arr(k+1) ) : null
      let res = rapi.operation("step1", 
              {input: rapi.reuse(data_arr(k)),left_block, right_block}, 
                {lang_env: "js", cell: data_arr_next(k)} )
      graph[ worker_ids[k] ] = [res]
    }
    return graph;
    //return { worker_ids[0]: [res] }
  }

  let iter_graph = iter_step_graph( 
      (k) => { return rapi.open_cell(k) },
      (k) => { return rapi.open_cell(k) }
  )

  //console.log("graph=",JSON.stringify(iter_graph,null," "))

  let init_data = rapi.submit_payload( [data] )
  let p_data = []
  //let p_data_cells = []
  for (let k=0; k<P; k++) {
    let c = rapi.create_cell( k )
    init_data.then( pi => {
      c.submit( {left:0, right:0, payload_info:pi} ) 
    })
    p_data.push( c )
    //p_data_cells = []
  }

  //rapi.exec( rapi.operation( "next_iter",{},"js"), {arg: {N: n, my_id: worker_ids[0], data: rapi.skip_payloads(prev)}, runner_id: worker_ids[0]})
  for (let k=0; k<P; k++)
       rapi.exec( rapi.operation( "next_iter",{},{lang_env:"js"}), 
        {arg: {k, N: n, P, my_id: worker_ids[k], p_data, iter_graph}, runner_id: worker_ids[k]})
  

/*
  worker_ids.forEach( runner_id => {
    rapi.exec( rapi.js( (args) => {
      console.log("sending rapi msg of start-iter",args)
      rapi.msg( {label:"start-iter", N: args.N} )
    }), {arg:{N: n}, runner_id})
  })*/

  //console.log("done. prev=",prev)

  let first_time = true
  rapi.query( "finished").done( (msg) => {
    if (first_time) {
      console.timeEnd("compute")
      first_time = false
      p_data.forEach( c => c.close() )
    }

    console.log("see finished",msg)

    if (msg.k == 0) {
      let cell = rapi.read_cell( msg.data.id )
      console.log("reading cell ",msg.data.id)
      cell.next().then( res => {
        rapi.get_payloads( res.payload_info ).then( data_r => {
          console.log(data_r)
        })
        
      })
    }
    /*
    rapi.get_data( msg.data ).then( p => {
      console.log(p) 
      //rapi.exit()
    })*/
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
#!/usr/bin/env -S node
// 2-vary - делаем разных роботов, смотрим что получается
// 1-v2 - рабочий вариант // 236ms
// 1 - первая попытка роботов. они же акторы. они же штуки которые деплоятся на воркерах. 
//     пока без суперроботов 

/*
*/

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
//import * as F from "./f.js"

function main( rapi, worker_ids ) {
  let n = 1001
  let data =  new Float32Array( 2 + DN / P )

  //let p_data = rapi.add_data( data )

  Promise.resolve( rapi.submit_payload_inmem( data ) ).then( pi => {

    let r1 = super_robot_1( rapi, "robo1", worker_ids, (x,left,right) => (left+right)/2 + Math.random() )
    // let r2 = super_robot_1( rapi, "robo2", worker_ids )

    let pr = pass_robot( rapi, "pass1", worker_ids, 1000 )

    let save = write_fs_robot( rapi,"save1", worker_ids )

    let pr2 = pass_each_robot( rapi, "pass2", worker_ids, 250 )
    let intersave = write_fs_robot( rapi,"save2", worker_ids,"stepping" )
    //let pr = pass_robot( rapi, "pass1", worker_ids, 1000 )
    //let pr2 = pass_robot( rapi, "pass2", worker_ids, 1000 )
    //let pr3 = pass_robot( rapi, "pass3", worker_ids, 1000 )

    //console.log("r1=",r1,"pi=",pi)

    // кольцо
    create_port_link( rapi, r1.output, pr.input )
    create_port_link( rapi, pr.output, r1.input )
    create_port_link( rapi, pr.finish, save.input )

    create_port_link( rapi, r1.output, pr2.input )
    create_port_link( rapi, pr2.output, intersave.input )
    /*
    create_port_link( rapi, pr.output, pr2.input )
    create_port_link( rapi, pr2.output, pr3.input )
    create_port_link( rapi, pr3.output, r1.input )
    */

    console.time("compute")
    // начальные данные  
    r1.input.forEach( input => rapi.create_cell( input.id ).submit( {left:0, right:0, payload_info: [pi] } ) )

    // печать результата
    rapi.read_cell( pr.finish[0] ).next().then( value => {
      console.timeEnd("compute")
      console.log("finished",value)
      rapi.get_one_payload( value.payload_info[0] ).then( data => {
         console.log(data)
      })
    })

  })
  
  

/*
  let r = worker_ids.map( (x,index) => start_robot_1(rapi,x,{index, id:index}))
  rapi.wait_all( r ).then( channels => {
    console.log("channels=",channels)
  })
*/  
}

function create_port_link( rapi, src_port, tgt_port ) {
  let link = src_port.map( (x,index) => rapi.create_link( x.id, tgt_port[index].id))

  link.destroy = () => console.log("todo: destroy link")
}

function super_robot_1( rapi, id, workers,f ) {
  let input_port = workers.map( (x,index) => rapi.open_cell( `${id}/input/${index}` ) )
  let output_port = workers.map( (x,index) => rapi.open_cell( `${id}/output/${index}` ) )
  
  let count = workers.length  
  let r = workers.map( (x,index) => start_robot_1( rapi,x,
       { index, id:`${id}/${index}`,
         input_port,output_port,count,
         f:rapi.compile_js(f)
       }))
  rapi.wait_all( r ).then( channels => {
    console.log("super_robot ",id," ready. subrobot channels=",channels)
  })

  let robot = { input: input_port, output: output_port }

  return robot
}

// todo канал остановки добавить
function start_robot_1( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello robot v1. args=",args)

    let {input_port, output_port, index, id, count} = args

    let in_data = rapi.read_cell( input_port[index] )
    let left = index > 0 ? rapi.read_cell(input_port[index-1]) : null
    let right = index < count-1 ? rapi.read_cell(input_port[index+1]) : null

    let out = rapi.create_cell(output_port[index])

    let f = args.f
    
    let counter = 0;
    function tick() {
      //console.log( "wait" )
      Promise.all( [in_data.next(), left ? left.next() : null, right ? right.next() : null] ).then( vals => {
        //console.log("ready!")
        //console.log("tick data! ",counter++," valus=",vals,)
        let [me,left_info,right_info] = vals
        rapi.get_one_payload( me.payload_info[0] ).then( data => {
          //console.log("payload!")
          //console.log("my data is",data,"processing")

          if (left_info) data[0] = left_info.right
          if (right_info) data[ data.length-1 ] = right_info.left

/*
          let k = data.length-1;        
          for (let i=1; i<k; i++) {
            data[i] = f( data[i], data[i-1], data[i+1] )
          }
*/

                    let k = data.length-1;
          let p_left = data[0]
          let p_my   = 0
          let p_right = data[1]
          //let p_right = 0
          //let t1 = process.hrtime.bigint()
          for (let i=1; i<k; i++) {
            p_my = p_right
            p_right = data[i+1]
            data[i] = f( p_my, p_left, p_right )
            //data[i] = (p_left + p_right)/2 + Math.random()
            p_left = p_my
          }

          //console.log("processed")

/*
          let pi = rapi.submit_payload_inmem( data )
          console.log("payload-sent")
          out.submit( { left: data[1], right: data[k-1], payload_info: [pi] })
*/          

          rapi.submit_payload_inmem( data ).then( pi => {
            //console.log("payload-sent")
            out.submit( { left: data[1], right: data[k-1], payload_info: [pi] })
          })
          
        })
      }).then( tick )
    }

    tick()

    //console.log("io=",{in,out})

    return true

  }, args), {runner_id}) 
}

////////////////////////////// pass
// пропускает N сигналов и больше не пропускает

function pass_robot( rapi, id, workers,N ) {
  let input_port = workers.map( (x,index) => rapi.open_cell( `${id}/input/${index}` ) )
  let output_port = workers.map( (x,index) => rapi.open_cell( `${id}/output/${index}` ) )
  let finish_port = workers.map( (x,index) => rapi.open_cell( `${id}/finish/${index}` ) )
  
  let count = workers.length  
  let r = workers.map( (x,index) => start_robot_2( rapi,x,
       { index, id:`${id}/${index}`,
         input_port,output_port,count,finish_port,
         N
         //f:rapi.compile_js(f)
       }))

  let robot = { input: input_port, output: output_port, finish: finish_port }

  return robot
}

// finish - канал остановки
function start_robot_2( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello robot v2. args=",args)

    let {input_port, output_port, finish_port, index, id, count, N} = args

    let in_data = rapi.read_cell( input_port[index] )
    let out = rapi.create_cell( output_port[index] )
    let finish = rapi.create_cell( finish_port[index] )

    let f = args.f
    
    let counter = 0;
    function tick() {
      in_data.next().then( val => {
        //console.log("pass-robot. N=",N)
        if (N-- <= 0) {
          finish.submit( val )
          return // остановка. todo: read_сell надо остановить
        }

        out.submit( val ) // пересылаем
        tick()       
      })
    }

    tick()

    return true

  }, args), {runner_id}) 
}

////////////////////////////// pass_each
// пропускает каждый N-й сигнал
// можно обобщить до робота с условием который если да - то в канал true пишет, а иначе в false
// но что это за условие кроме номера сказать сложно - это же над пучком работа

function pass_each_robot( rapi, id, workers,N ) {
  let input_port = workers.map( (x,index) => rapi.open_cell( `${id}/input/${index}` ) )
  let output_port = workers.map( (x,index) => rapi.open_cell( `${id}/output/${index}` ) )
  
  let count = workers.length  
  let r = workers.map( (x,index) => start_pass_each_robot( rapi,x,
       { index, id:`${id}/${index}`,
         input_port,output_port,count,
         N
         //f:rapi.compile_js(f)
       }))

  let robot = { input: input_port, output: output_port }

  return robot
}

function start_pass_each_robot( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello robot v2. args=",args)

    let {input_port, output_port, index, id, count, N} = args

    let in_data = rapi.read_cell( input_port[index] )
    let out = rapi.create_cell( output_port[index] )

    let f = args.f
    
    let counter = 0;
    function tick() {
      in_data.next().then( val => {
        //console.log("pass-each-robot. N=",N,"counter=",counter)
        if (counter % N == 0) {
          //console.log("submiting")
          out.submit( val )
        }

        counter++
        
        tick()       
      })
    }

    tick()

    return true

  }, args), {runner_id}) 
}

////////////////////////////// reduce
// возвращает массив, в котором только каждая N-я точка (т.о. сокращает в N раз)
function reduce_robot( rapi, id, workers,N, start_index=0 ) {
  let input_port = workers.map( (x,index) => rapi.open_cell( `${id}/input/${index}` ) )
  let output_port = workers.map( (x,index) => rapi.open_cell( `${id}/output/${index}` ) )
  
  let count = workers.length  
  let r = workers.map( (x,index) => start_reduce_robot( rapi,x,
       { index, id:`${id}/${index}`,
         input_port,output_port,count,start_index,N
         //f:rapi.compile_js(f)
       }))

  let robot = { input: input_port, output: output_port }

  return robot
}

function start_reduce_robot( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello robot reduce. args=",args)

    let {input_port, output_port, start_index, index, id, count, N} = args

    let in_data = rapi.read_cell( input_port[index] )
    let out = rapi.create_cell( output_port[index] )

    let f = args.f
    
    let counter = 0;
    let result_len = -1
    let result

    function tick() {
      in_data.next().then( val => {

        rapi.get_one_payload( val.payload_info[0] ).then( data => {

          let result_len2 = Math.floor( (data.length-start_index)/N )
          if (result_len2 != result_len) {
            result_len = result_len2
            // создаём массив для результатов
            result = new Float32Array( result_len )
          }

          //console.log("pass-robot. N=",N)        
          for (let j=start_index,i=0; j < val.length; j+= N, i++) {
            result[i] = data[j]
          }        
          rapi.submit_payload_inmem( result ).then( pi => {
            out.submit( {payload_info:pi} ) // пересылаем          
          })

        }).then( tick )        
      })
    }

    tick()

    return true

  }, args), {runner_id}) 
}

////////////////////////////// write_fs
// сохраняет данные в файл
function write_fs_robot( rapi, id, workers, prefix='output' ) {
  let input_port = workers.map( (x,index) => rapi.open_cell( `${id}/input/${index}` ) )
  let output_port = workers.map( (x,index) => rapi.open_cell( `${id}/output/${index}` ) )
  
  let count = workers.length  
  let r = workers.map( (x,index) => start_write_fs_robot( rapi,x,
       { index, id:`${id}/${index}`,
         input_port,output_port,count,prefix,
         //f:rapi.compile_js(f)
       }))

  let robot = { input: input_port, output: output_port }

  return robot
}

//import { writeFile } from 'node:fs/promises';

function start_write_fs_robot( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello robot write_fs. args=",args)

    let {input_port, output_port, prefix, index, id, count} = args

    let in_data = rapi.read_cell( input_port[index] )
    let out = rapi.create_cell( output_port[index] )
    
    let counter = 0;

    import( 'node:fs/promises' ).then( fsp => {     

      function tick() {
        in_data.next().then( val => {
          //console.log("tick next SAVA")

          rapi.get_one_payload( val.payload_info[0] ).then( data => {

             let fname = `${prefix}_${index}_${counter}.txt`
             //console.log("got payload,saving to ",fname)
             // todo мб лучше писать через потоки
             let txt = ""           
             for (let i=0; i<data.length; i++)
                txt += data[i].toString() + "\n"
             const promise = fsp.writeFile(fname, txt);

             out.submit( fname )
             counter++

          }).then( tick )
        })
      }

      tick()

    })

    return true

  }, args), {runner_id}) 
}
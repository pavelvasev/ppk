// редукция значений - поточечная

export function robot( rapi, id, workers,f,f_acc_init,f_acc_finish,border_size=0 ) {
  let input_port = workers.map( (x,index) => rapi.open_cell( `${id}/input/${index}` ) )
  let output_port = workers.map( (x,index) => rapi.open_cell( `${id}/output/${index}` ) )

  f_acc_init ||= () => 0
  f_acc_finish ||= (x) => x
  
  let count = workers.length  
  let r = workers.map( (x,index) => start_robot_1( rapi,x,
       { index, id:`${id}/${index}`,
         input_port,output_port,count,border_size,
         f:rapi.compile_js(f),
         f_acc_init:rapi.compile_js(f_acc_init),
         f_acc_finish:rapi.compile_js(f_acc_finish)
       }))

  let robot = { input: input_port, output: output_port }

  return robot
}

// todo канал остановки добавить
function start_robot_1( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello reduce-1d robot. args=",args)

    let {input_port, output_port, index, id, count,border_size, f, f_acc_init, f_acc_finish} = args

    let in_data = rapi.read_cell( input_port[index] )
    let out = rapi.create_cell(output_port[index])    
    
    let counter = 0;
    function tick() {

      Promise.all( in_data.next() ).then( me => {

        rapi.get_one_payload( me.payload_info[0] ).then( data => {

          let k = data.length-border_size;
          let acc = f_acc_init(k-1)
          for (let i=border_size; i<k; i++) {
            acc = f( data[i], acc, i-1 )
          }
          acc = f_acc_finish(acc, k-1)

          out.submit( acc )
          
        })
      }).then( tick )
    }

    tick()

    return true

  }, args), {runner_id})
}

////////////////////////////// pass_each
// пропускает каждый N-й сигнал
// можно обобщить до робота с условием который если да - то в канал true пишет, а иначе в false
// но что это за условие кроме номера сказать сложно - это же над пучком работа

export function robot( rapi, id, workers,N ) {
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


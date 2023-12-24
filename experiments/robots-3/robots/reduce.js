////////////////////////////// reduce

// возвращает массив, в котором только каждая N-я точка (т.о. сокращает в N раз)
export function robot( rapi, id, workers,N, start_index=0 ) {
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


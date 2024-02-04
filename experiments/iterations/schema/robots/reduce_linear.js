// редукция значений каналов. линейная.

export function robot( rapi, id, workers, f ) {
  let input_port = workers.map( (x,index) => rapi.open_cell( `${id}/input/${index}` ) )
  let output_port = [ rapi.open_cell( `${id}/output` ) ]
  
  let count = workers.length  
  let r = start_robot( rapi,workers[0],
       { 
         input_port,output_port,count,
         f:rapi.compile_js(f)
       })

  let robot = { input: input_port, output: output_port }

  return robot
}

function start_robot( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello reduce-linear robot. args=",args)

    let {input_port, output_port, start_index, index, id, count, N, f} = args

    let in_data = input_port.map( name => rapi.read_cell( name ))
    let out = rapi.create_cell( output_port[0] )
    
    let counter = 0;

    function tick() {
      let p_vals = in_data.map( x => x.next() )
      Promise.all( p_vals ).then( vals => {        
        //console.log("pppassing",vals,counter)
        let result = f( vals, counter )
        //console.log("result=",result)
        counter++
        out.submit( result )
      }).then( tick ) // all vals             
    }

    tick()

    return true

  }, args), {runner_id}) 
}
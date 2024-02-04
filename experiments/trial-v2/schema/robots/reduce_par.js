// редукция значений каналов. параллельная

export function robot( rapi, id, workers, f ) {
  let input_port = workers.map( (x,index) => rapi.open_cell( `${id}/input/${index}` ) )
  let output_port = line( rapi, input_port, workers, rapi.compile_js(f), `${id}/pyr` )
  let robot = { input: input_port, output: output_port }
  return robot
}

function line( rapi, input_port, workers,f,output_port_prefix ) 
{
  let K=4
  let output_port = []
  let output_workers = []
  for (let i=0; i<input_port.length; i+=K) {
    let output_cell = rapi.open_cell(`${output_port_prefix}/${i}`)
    let inp = input_port.slice(i,i+K) // входные каналы для этого участка
    console.log("line: spawning par index=",i,"inp=",inp,"out=",output_cell.id)
    let r = start_robot( rapi,workers[i],
       { 
         input_port: inp,
         output_port: [output_cell],
         f         
       })
    output_port.push( output_cell )
    output_workers.push( workers[i] )
  }
  if (output_port.length > 1)
    return line( rapi, output_port,output_workers,f,output_port_prefix+"/^" )

  return output_port
}

function start_robot( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello reduce-par robot. args=",args)

    let {input_port, output_port, f} = args

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
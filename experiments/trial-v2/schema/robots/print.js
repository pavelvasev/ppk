////////////////////////////// print
// печатает данные на экран
export function robot( rapi, id, workers, prefix='output' ) {
  let input_port = workers.map( (x,index) => rapi.open_cell( `${id}/input/${index}` ) )
  let output_port = workers.map( (x,index) => rapi.open_cell( `${id}/output/${index}` ) )
  
  let count = workers.length  
  let r = workers.map( (x,index) => start_robot( rapi,x,
       { index, id:`${id}/${index}`,
         input_port,output_port,count,prefix,
         //f:rapi.compile_js(f)
       }))

  let robot = { input: input_port, output: output_port }

  return robot
}

//import { writeFile } from 'node:fs/promises';

function start_robot( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello robot write_fs. args=",args)

    let {input_port, output_port, prefix, index, id, count} = args

    let in_data = rapi.read_cell( input_port[index] )
    let out = rapi.create_cell( output_port[index] )
    
    let counter = 0;

    

      function tick() {
        in_data.next().then( val => {
          //console.log("tick next SAVA")

          rapi.get_one_payload( val.payload_info[0] ).then( data => {

             let title = `${prefix}_${index}_${counter}:`
             console.log( title, data )
             
             counter++

          }).then( tick )
        })
      }

      tick()

    

    return true

  }, args), {runner_id}) 
}
////////////////////////////// write_fs
// сохраняет данные в файл
export function robot( rapi, id, workers, prefix='output' ) {
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
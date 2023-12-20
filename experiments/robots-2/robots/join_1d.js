////////////////////////////// join 1d
// это 1-тактный алгоритм. еще надо сделать вариант попарный пирамидальный

// возвращает массив равный объединению всех массивов
export function robot( rapi, id, workers,N, start_index=0 ) {
  let input_port = workers.map( (x,index) => rapi.open_cell( `${id}/input/${index}` ) )
  let output_port = [ rapi.open_cell( `${id}/output/0` ) ]
  
  let count = workers.length  
  let r = start_robot( rapi,x,
       { index, id:`${id}/${index}`,
         input_port,output_port,count,start_index,N
         //f:rapi.compile_js(f)
       })

  let robot = { input: input_port, output: output_port }

  return robot
}

function start_robot( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello robot reduce. args=",args)

    let {input_port, output_port, start_index, index, id, count, N} = args

    let in_data = input_port.map( name => rapi.read_cell( name ))
    let out = rapi.create_cell( output_port[0] )

    let f = args.f
    
    let counter = 0;
    let result_len = -1
    let result

    function tick() {
      let p_vals = in_data.map( x => x.next() )
      Promise.all( p_vals ).then( vals => {

        let p_datas = vals.map( v => rapi.get_one_payload( val.payload_info[0] ) )

        return Promise.all( p_datas ).then( datas => {
            let result_len2 = datas.reduce( (acc,data) => acc + data.length,0)
            if (result_len2 != result_len) {
              result_len = result_len2
              // создаём массив для результатов
              result = new Float32Array( result_len )
            }

            // копируем
            for (let i=0,pos = 0; i<datas.length; i++) {
                result.set( datas[i], pos )
                pos += datas[i].length
            }

            // публикуем результат
            return rapi.submit_payload_inmem( result ).then( pi => {
              out.submit( {payload_info:pi} ) // пересылаем          
              
            })

          })

        }).then( tick ) // all vals             
    }

    tick()

    return true

  }, args), {runner_id}) 
}


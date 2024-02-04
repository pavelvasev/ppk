////////////////////////////// join 1d
// это 1-тактный алгоритм. еще надо сделать вариант попарный пирамидальный
// masked = с цветами

// F-COLOR-PARTS добавить число с номером процесса. ну 2х байт хватит наверное.
// хотя формально проще это закодировать.. но ладно, пока чем проще тем лучше
// плюс это особый информационный канал. т.о. есть канал таких значений, есть сяких..
// т.о. просто мы добавляем еще один канал. а так выходит что у нас сигнал многоспектральный
// и в этом нет ничего плохого. может там еще производную считают
// (но тогда надо все каналы будет собирать.. а не ток 1 массив.. ы!)

// возвращает массив равный объединению всех массивов
export function robot( rapi, id, workers ) {
  let input_port = workers.map( (x,index) => rapi.open_cell( `${id}/input/${index}` ) )
  let output_port = [ rapi.open_cell( `${id}/output/0` ) ]
  
  let count = workers.length  
  let r = start_robot( rapi,workers[0],
       { 
         input_port,output_port,count, client_id: rapi.client_id
         //f:rapi.compile_js(f)
       })

  let robot = { input: input_port, output: output_port }

  return robot
}

function start_robot( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello join-1d-masked robot. args=",args)

    let {input_port, output_port, start_index, index, id, count, N} = args

    let in_data = input_port.map( name => rapi.read_cell( name ))
    let out = rapi.create_cell( output_port[0] )

    let f = args.f
    
    let counter = 0;
    let result_len = -1
    let result
    let result_uid // F-COLORED-PARTS указываем номер участка

    function tick() {
      let p_vals = in_data.map( x => x.next() )
      Promise.all( p_vals ).then( vals => {
        //console.log("join 1-d all vals here! joining")
        let p_datas = vals.map( v => rapi.get_one_payload( v.payload_info[0] ) )

        return Promise.all( p_datas ).then( datas => {
            let result_len2 = datas.reduce( (acc,data) => acc + data.length,0)
            // result_len2 - суммарный объем данных прочитанных сейчас
            if (result_len2 != result_len) {
              result_len = result_len2
              // создаём массив для результатов длины result_len
              result = new Float32Array( result_len )
              result_uid = new Uint16Array( result_len )
            }

            // копируем
            for (let i=0,pos = 0; i<datas.length; i++) {

                /*
                let data_arr = datas[i]
                let data_len = data_arr.length;
                for (let k=0; k<data_len; k++,pos++ ) {
                  result[pos] = data_arr[k]
                  result_uid[pos] = i
                }
                */
                result.set( datas[i], pos )
                let next_pos = pos + datas[i].length
                result_uid.fill( i, pos, next_pos )
                pos = next_pos
            }

            // публикуем результат            
            return rapi.submit_payload_inmem( [result,result_uid] ).then( pi => {
              console.log("join-1d-masked: writing out:",out.id)
              out.submit( {payload_info:pi} ) // выдаем
            }).then( tick )

          })

        }, () => {} ) //.then( tick  ) // all vals             
    }

    tick()

    // F-STOP-ROBOTS    
    rapi.shared_list_reader( args.client_id ).deleted.subscribe( () => {
      console.log("join-1d-masked robot stop - client stopped")
      in_data.map( x => x.stop() )
      out.stop()
    } )   

    return true

  }, args), {runner_id}) 
}


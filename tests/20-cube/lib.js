#!/usr/bin/env node

import * as PPK from "../../client-api/client-api.js"

let __dirname,renderlib,melib;

import { dirname } from 'path';
import { fileURLToPath } from 'url';

//configure( dirname(fileURLToPath(import.meta.url)) )
configure( dirname( fileURLToPath( import.meta.url ) ) )

export function configure( newdirname ) {
  __dirname = newdirname
  renderlib = __dirname + "/lib-render.js";
  melib = __dirname + "/lib.js";
}

export function generate_one_block_content( minmax, coef=1/1000.0) {
  
  let len = 3*(minmax.x2-minmax.x1)*(minmax.y2-minmax.y1)*(minmax.z2-minmax.z1)
  console.log("generate_one_block_content len=",len)
  let res = new Float32Array( len )

  let cnt=0
  for (let x=minmax.x1; x<minmax.x2; x++)
    for (let y=minmax.y1; y<minmax.y2; y++)
      for (let z=minmax.z1; z<minmax.z2; z++) {
         //res[ cnt ] = Math.random()
        res[cnt++] = x*coef
        res[cnt++] = y*coef
        res[cnt++] = z*coef
        // в нашем случае неэффективно но неважно - пригодится для фильтрации
        // такая геометрия
      }
  console.log("generate_one_block_content done. res.length=",res.length)    
  return res
}

// tgt_blocks_label на вылет похоже
export function spawn_generate_blocks( ppk, tgt_blocks_label, cube_size=[1000,1000,1000], part_size=[1000,1000,20] )
{
  console.log( "spawn_generate_blocks:",{tgt_blocks_label,cube_size,part_size} )
  let results = []

  let rr = part_size; //[ 1000, one_block_side, one_bs2 ] // размер одного блока - мб сделать параметром
  let tgt = cube_size; //[ 1000, 1000, zzz ] // создаваемая область. итого надо 1000x1000x1000
  let cnt = 0
  for (let x=0; x<tgt[0]; x+=rr[0])
    for (let y=0; y<tgt[1]; y+=rr[1])
      for (let z=0; z<tgt[2]; z+=rr[2]) {
        let minmax = { x1: x, x2: x+rr[0],
                       y1: y, y2: y+rr[1],
                       z1: z, z2: z+rr[2] }
        //console.log("spawning task",{minmax,tgt_blocks_label})
        cnt++
        let r = ppk.exec( ppk.js( (args) => {
          return import( args.me ).then( modul => {
            let b = modul.generate_one_block_content( args.minmax )
            return {
                 minmax: args.minmax,
                 block_id: args.block_id, // пока так
                 id: args.tgt_blocks_label + "#"+args.block_id, // надо для вычисления need id
                 ms: 1000*60*60,
                 payload: [b]
               }
          })
        }, {block_id: cnt, minmax,tgt_blocks_label,me:melib}), 
           {hint:{text:`generate block ${cnt}`,coview:{Z:cnt}}})
        results.push( r )
      }
  console.log("done. tasks made:",cnt)
  
  return results
}

export function mk_camera_fly0( steps, cb ) {
  for (let step=0; step<steps; step++) {
    let angle = 2*Math.PI*step / steps + Math.PI/2
    let r = 2
    let pos = [ 0.5 + r*Math.cos( angle ), 0.5, 0.5 + r*Math.sin( angle ) ]
    //ppk.add( {label: tgt_cam_label, cnt: i, position: p})
    cb( pos, step )
  }
  return steps
}

// корявое название define_render_needs нерпавильноеs 
export function define_render_needs( rapi, src_blocks_label )
{
  let renderlib = __dirname + "/lib-render.js";

  // генерирует вершины и индексы меша
  // но вообще уже не используется
  /*
  rapi.define( 'block_mesh', rapi.js( (arg) => {
        // ну формально да, все эти промисы это кандидаты на элементы режимов среды        
        return rapi.get_payloads( arg.block.payload_info ).then( payload => {
          let positions = payload[0]
          console.log( '**************** block_mesh import',arg.renderlib)
          return import( arg.renderlib ).then( modul => { // по идее наоборот сначала загрузи (и кстати это тож режим) а потом грузи пейлоады ибо они меняются.
            // приколькно - код с импоритрованной либой = новый режим
            // console.log('EEEEEEEEE OOOOOOOOOOOOO', !!positions)
            let payload = modul.makeBoxes2( positions );
            return { result: [payload[0].length, payload[1].length, payload[2].length], payload }
          })
        }) // get_payloads
      }, {renderlib} ) )
  */    

  // по вершинам индексам меша, выдает функцию их рендеринга
  // https://nodejs.org/api/child_process.html#child_processspawncommand-args-options
  // рендер-функция возвращает промису которая резолвится с пейлоад-записью

  // вот таки хорошо бы уметь.. указывать то аргументы.. а то опять не проверяю...
  rapi.define( 'mesh_render_func', rapi.js( arg => {

    //console.log("MRF! PI=",arg.block.payload_info)
    if (!arg.block) {
      console.error("MRF! arg.block is null!!!!!!!!!!!!!!!!!!!!!!!!!")
    }
        return import('node:child_process').then( modul => {

          let prgpath = arg.dirname + "/modul4/vis-mesh.py"
          let pp = arg.block.payload_info
          
          let args = [ pp[0].url, "-", rapi.submit_payload_url, arg.w, arg.h ]
          let prg = modul.spawn( prgpath, args )
          let prg_exited = false

          let next_cb = () => {}
          prg.stdout.on('data', (data) => {
            data = data.toString()
            console.log(">>>>> subprocess stdout:",data)
            next_cb( data );
            next_cb = () => {}            
          });
          prg.stderr.on('data', (data) => {
            data = data.toString()
            console.log(`>>>>> subprocess [${prg.pid}] `,"stderr:",data)
          });
          prg.on('error', (data) => {
            console.log(`>>>>> subprocess [${prg.pid}] `,"error:",data)
            exit_cb("exitcode=error")
          });
          prg.on('spawn', (data) => {
            console.log(`>>>>> subprocess [${prg.pid}] `,"spawned!")
          });
          // todo на spawn и error надо посадить резолв промисы. а не просто render_func..

          let exit_cb = () => {}
          prg.on('exit', (code,signal) => {
            console.log(`>>>>> subprocess [${prg.pid}] `,"exited! code=",code,signal)
            prg_exited = true // почему-то killed там не всегда выставляется

            if (code == 1 || code == null)
              exit_cb(`exitcode=1 pid=${prg.pid}`)
              //throw "suprocess serios error!"
          });

          prg.stdin.on('error', function(error) {
            console.log(`>>>>> subprocess [${prg.pid}] `,'stdin error: ' + error.code);
          });

          let render_function = ( camera_pos=[ 0.5, 0.5, 2 ], camera_look_at=[0.5, 0.5, 0.5] ) => {
            if (prg.killed || prg_exited) {
              console.error(`>>>>> subprocess [${prg.pid}] `,"returning reject")
              return Promise.reject('prg already killed')
            }

            let arr = camera_pos.concat( camera_look_at )
            prg.stdin.cork()
            let str = arr.join(" ") + "\n"
            prg.stdin.write( str ); // пишем ей строчку с координатами камеры
            prg.stdin.uncork() // такое у них флаш
            console.log(`<<<< writed to subprocess [${prg.pid}] stdin:`,str )
            return new Promise( (resolve,reject) => {
                // получаем пейлоады картинки и збуфер
                exit_cb = reject
                next_cb = ( str ) => {
                  let arr = str.split("===")
                  let payload = [
                    { url: arr[0], type: "Uint8Array"},
                    { url: arr[1], type: "Float32Array"}
                  ]
                  exit_cb = () => {}
                  resolve( payload )
                }
             })
          }
          render_function.cleanup = () => {
            console.log("render_function.cleanup called! !!!!!!!!!!!!!!!!!!!!!! @@@@@@@@@@@@@@@@2 pid=", prg.pid)
            if (prg_exited) {
              console.log("prg_exited, doing nothing")
              return
            }
            return new Promise( (resolv,reject) => {
              // такая техника.. надо дождаться завершения.
              prg.on('exit',() => {
                resolv(true)
              })
              prg.kill()
              console.log('waiting for actual subprocess exit.. pid=',prg.pid)
            })
            
          }
          // кстати переделать ее надо в promise похоже
          /*
          render_function.resources_usage = () => {
            return { 
               ram: 300*1024*1024 + arg.mesh_data.result[0]*4 + arg.mesh_data.result[1]*4 + arg.mesh_data.result[2]*4, 
               gpu: arg.mesh_data.result[0]*4 + arg.mesh_data.result[1]*4 + arg.mesh_data.result[2]*4 
            }
          }
          */
          return render_function
          /* как вариант
          return new Promise( (res,rej) => {
             prg.on('spawn', (data) => {
               res( render_function )
             });
          })
          */

        })
  }, {dirname: __dirname, renderlib} ),
     {limits:(arg) => {
        //console.log('computing RRR limits. arg.block.payload_info[0].length=',arg.block.payload_info[0].length)
        // длина блока умножена на 2 т.к. там еще цвета ж
        return { 
               ram: (50*1024*1024 + arg.block.payload_info[0].length*4*2*2.7 + arg.w*arg.h*4*2)*1.5, // а на мелких не 3 а 1.5.. че к чему
               //ram: (150*1024*1024 + arg.block.payload_info[0].length*4*2 + arg.w*arg.h*4*2)*3, // а на мелких не 3 а 1.5.. че к чему
               gpu: (arg.block.payload_info[0].length*4*2 + arg.w*arg.h*4*2)*7/5.0
            }
     }}
     )

}

// смешно что camera-pos это не реакция а параметр
// по идее формально надо - реагировать на camera-pos и на src_blocks_label
// а пока что получается src_blocks_label это.. ну такое наличие..
// хотя формально у нас реакции пока умеют ток что-то одно искать поэтому все-равно
// будет реакция в реакции. но я уже почти готов к реакциям на-любое (хотя тут надо И а не или..)
export function spawn_render( rapi, blocks, camera_pos, camera_look_at, w, h, cookie )
{
  return blocks.map( (block) => {
          // задание
          // block это блок с пейлоадом - что нарендерить. координаты вершин там в ево пейлоаде.
          return rapi.exec( rapi.js( (args) => {
              
                  return args.render_func( args.camera_pos, args.camera_look_at ).then( payload_info => {
                      return {
                             w: arg.w,
                             h: arg.h,
                             payload_info
                      }
                  })

          },{
             camera_pos, 
             camera_look_at,
             w, 
             h,
             render_func: { 
                code: "mesh_render_func",
                need: true,
                arg: {block,w,h},
                hint: {coview:block.hint.coview}
             },
            }
         ), 
         {hint:{text:`render block ${block.id} from pos ${camera_pos} look_at ${camera_look_at} cookie ${cookie}`,coview:block.hint.coview},result_msg:{} })
  
  })

}


// цель - собрать пирамидкой изображения в одно
// todo продолжить: наверное убрать постинг png и вынести его в отдельный метод
// так проще будет.
export function spawn_join_n( rapi, src_images, tgt_image_label, tgt_image_cookie )
{
  let renderlib = __dirname + "/lib-render.js";

  let merged_images = [];
  for (let i=0; i<src_images.length; i+=2 ) {
    let image1 = src_images[i]  
    let image2 = src_images[i+1]
    if (!image2) {
      merged_images.push( image1 )
      continue;
    }

    let e = rapi.exec( rapi.js( (args) => {
          console.log('!!!!!!!!!!!!!!!1 welcome to merge, args=',args)
          return rapi.get_payloads( args.image1.payload_info.concat( args.image2.payload_info ) ).then( payload => {
            //console.timeEnd("get_payloads") 
            // проводим к формату пригодному для join_imagedata
            let i1 = { width: args.image1.w, height: args.image1.h, data: payload[0], zbuffer: payload[1] }
            let i2 = { width: args.image1.w, height: args.image1.h, data: payload[2], zbuffer: payload[3] }

            return import( args.renderlib ).then( modul => {
              console.time("join_imagedata")
              let b = modul.join_imagedata( i1,i2 )
              console.timeEnd("join_imagedata")
              
              //console.log('args.isfinal=',args.isfinal)
              // это уйдет либо в отдельное либо еще куды
              if (args.final_level) {
                console.time("PNGpack")
                let pngbytes = modul.bytes2png_buffer( b.data, b.width, b.height )
                console.timeEnd("PNGpack")
                console.log("pngbytes=",pngbytes.length,"orig bytes=",b.data.length)
                //console.log('spawn_join_n: POSTING MERGED result',args.tgt_image_label, [ b.data, b.zbuffer ])
                // таки запулим png байты
                //console.time("PNGpack:2-arr")
                //let pngarr = Array.from( pngbytes )
                //console.timeEnd("PNGpack:2-arr")
                return rapi.msg( 
                    { 'label': args.tgt_image_label, 
                       w: b.width, h: b.height,
                       cookie: arg.tgt_image_cookie,
                       payload: [pngbytes],
                       ms: 1000*10000 } )
              }

              return {
                w: args.image1.w, h: args.image1.h,
                payload: [ b.data, b.zbuffer ]
              }
              
            })
          })
          },
          {renderlib,
           tgt_image_label,tgt_image_cookie,
           final_level: (src_images.length == 2),
           image1, image2
         }), {hint:{text:`join image data`,coview:image1.hint.coview},result_msg:{}})

     merged_images.push( e )    
  }

  // в случае нечетного исходного колва скопируем последнюю картинку на след уровень
  /*
  if (src_images.length % 2) 
    merged_images.push( src_images[ src_images.length-1 ])
  */  

      //console.log('spawn_join_n: scheduling perform join of 2 blocks, payload_info=',payload_info)

  if (merged_images.length > 1) {
    // следующий уровень пирамидки
    spawn_join_n( rapi, merged_images, tgt_image_label, tgt_image_cookie )
  }
}

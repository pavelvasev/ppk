#!/usr/bin/env -S node

// service2 возможность указывать локальные параметры камеры для рендер-а

//#!../../main.sh
//##!/usr/bin/env -S node

import * as PPK from "../../client-api/client-api.js"
import * as STARTER from "../../client-api/starter.js"

import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

import * as LIB from "./lib.js"
import * as LIBR from "./lib-render.js"

import { writeFile } from 'node:fs/promises';

let S
let use_umt = process.env.UMT
if (use_umt) {
  S = new STARTER.Slurm()
  LIB.configure( "/home/u1321/_scratch2/ppk/k2/tests/20-cube/" )    
}
else {
  S = new STARTER.Local()
}
//let S = new STARTER.Local()

let jobs_count = parseInt( process.env.JOBS || (use_umt ? 4 : 1) )  
let jobs_count2 = parseInt( process.env.JOBS2 || 0 )

let wait_runners = jobs_count*4 + jobs_count2*2
S.start(wait_runners).then( (info) => PPK.connect("service",info,process.env.VERBOSE) ).then(mozg => {

  console.log("connected")


  if (jobs_count > 0) {
    console.log("starting workers. jobs_count=",jobs_count)
  S.start_workers( jobs_count,4,4*10*1000,1,'-t 40 --gres=gpu:v100:1 -p v100' ).then( (statuses) => {
    console.log("workers started",statuses)
  }).catch( err => {
    console.log("workers error",err)
    process.exit()
  })
  }

  // задачи на tesla-узлы кластера
  if (jobs_count2 > 0) {
/*
//  https://parallel.uran.ru/node/3 64 гб на тесла-узел, и 8 видеокарт, т.е. 8гб на жобу
    S.start_workers( jobs_count2,2,8*1000,1,'-t 40 --gres=gpu:1' ).then( (statuses) => {
*/
    console.log("starting workers2. jobs_count2=",jobs_count2)
    if (jobs_count2 > 0)
    S.start_workers( jobs_count2,2,8*1000,1,'-t 40 --gres=gpu:1' ).then( (statuses) => {
    //S.start_workers( jobs_count2,4,20*1000,1,'-t 40 --gres=gpu:1' ).then( (statuses) => {
        console.log("workers started",statuses)
      }).catch( err => {
        console.log("workers error",err)
        process.exit()
    })
  }

  mozg.msg( {label:'create-korzinka',crit:'cube1',ms:1000*60*60*10} )

  ///setTimeout( () => main_algo(mozg), 5000 )
  //setTimeout( () => main_algo(mozg),5000 )
  main_algo(mozg)

})

//})

//}

//console.log(`https://vr.viewlang.ru/vrungel/index.html?src=%2Fvrungel%2Fapps%2Fcoview-3%2Fmain.cl#%7B%22vrungel%22%3A%7B%22children%22%3A%7B%22project%22%3A%7B%22children%22%3A%7B%22l1%22%3A%7B%22children%22%3A%7B%22cam%22%3A%7B%22params%22%3A%7B%22pos%22%3A%5B16.129495895901904%2C18.875262516572544%2C11.782343152662019%5D%2C%22center%22%3A%5B0%2C0%2C0%5D%7D%7D%2C%22item%22%3A%7B%22params%22%3A%7B%22manual_features%22%3A%5B%22show-cube%22%5D%7D%2C%22manual%22%3Atrue%2C%22order%22%3A6%7D%7D%7D%2C%22v1%22%3A%7B%22params%22%3A%7B%22sources_str%22%3A%22%22%7D%2C%22children%22%3A%7B%22_area_container_horiz%22%3A%7B%22children%22%3A%7B%22_area_3d%22%3A%7B%22params%22%3A%7B%22sources_str%22%3A%22%40l1%22%7D%7D%7D%7D%7D%7D%7D%7D%2C%22screen1%22%3A%7B%22children%22%3A%7B%22rp%22%3A%7B%22children%22%3A%7B%22_collapsible%22%3A%7B%22params%22%3A%7B%22expanded%22%3Atrue%7D%2C%22children%22%3A%7B%22_column%22%3A%7B%22children%22%3A%7B%22_manage_main_objects%22%3A%7B%22children%22%3A%7B%22d%22%3A%7B%22children%22%3A%7B%22_column%22%3A%7B%22children%22%3A%7B%22ssr%22%3A%7B%22params%22%3A%7B%22index%22%3A2%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%7D%2C%22rrviews_group%22%3A%7B%22children%22%3A%7B%22of%22%3A%7B%22params%22%3A%7B%22objects_params%22%3A%5Bnull%5D%7D%7D%7D%7D%7D%7D%7D%7D%2C%22item%22%3A%7B%22params%22%3A%7B%22url%22%3A%22http%3A%2F%2F127.0.0.1%3A8000%2Ftests%2F20-cube%2Fcoview-plugin%2Fshow-cube.cl%22%2C%22manual_features%22%3A%5B%22plugin-from-url%22%5D%7D%2C%22manual%22%3Atrue%2C%22order%22%3A9%7D%7D%7D%7D`)

//////////////////////////////////////
//////////////////////////////////////
//////////////////////////////////////

function main_algo(mozg) {
  console.log("main_algo started.")
  let cube_size = process.env.CUBE_SIZE ? JSON.parse( process.env.CUBE_SIZE ) : undefined
  let part_size = process.env.PART_SIZE ? JSON.parse( process.env.PART_SIZE ) : undefined
  //console.log( {cube_size, part_size} )
  let blocks = LIB.spawn_generate_blocks( mozg, `cube1`,cube_size, part_size )
  console.log("N of blocks",blocks.length)

  let w = 1200
  let h = 800

  // todo подумать о выносе префикса
  //let tapi = tasks.init( rapi )
  LIB.define_render_needs( mozg )

  let camera_pos = [1,1,1]
  let camera_look_at = [0.5, 0.5, 0.5]

  //let query = PPK.qlib.init( mozg )
  
  mozg.query("camera_params").done(q => {
    console.log("see camera pos",q )
    if (q.camera_pos) camera_pos = q.camera_pos
    if (q.camera_look_at) camera_look_at = q.camera_look_at
    if (q.width) w = q.width
    if (q.height) h = q.height
    mozg.msg( {label: "render", camera_pos: q.camera_pos, camera_look_at: q.camera_look_at} ) // msg так-то.
  })
  
  //let t_render = 0
  let q_issued = mozg.query("render").done(q => {
    let r_camera_pos = q.camera_pos || camera_pos
    let r_camera_look_at = q.camera_look_at || camera_look_at
    //let tag = r_camera_pos.concat( r_camera_look_at ).concat( [w,h] )
    console.time("render-to-image"+q.cookie)
    console.log("see render, submitting tasks",w,h,r_camera_pos,r_camera_look_at)
    let renders = LIB.spawn_render( mozg, blocks, r_camera_pos, r_camera_look_at, w, h, q.cookie )
    LIB.spawn_join_n( mozg, renders,`image`,q.cookie )
  })
  
  let ico=0
  mozg.query("image").done(q => {
    console.timeEnd("render-to-image"+q.cookie)
    console.log("images generated",ico++)
  })

 // TEST2 не ждем завершения рендеринга всего
 if (process.env.TEST2) {
    function step(alfa,cookie) {
      let r = 3
      camera_pos = [ r*Math.cos( alfa*Math.PI/180 ), r*Math.sin( alfa*Math.PI/180 ), 3 ]
      console.log("test mode: submitting render",alfa)
      mozg.msg({label:"render", cookie, camera_pos})
    }

    let cnt=0
    mozg.query("image").done( q => {
      console.log("see result image ",q)
      mozg.get_payloads( q.payload_info ).then( arr => {
        let imagebytes = arr[0]
        let fname = `log/image-${q.cookie}.png`
        console.log("see png bytes",imagebytes,"saving to file",fname,cnt)
        let prom = writeFile( fname, imagebytes )        

        if (cnt++ >= 36) {
            console.log("cnt is good, scheduling exit")  
            prom.then( () => {
              console.log("cnt is good, exiting")  
              process.exit(0)
            })
            
        }
      })
    })
    // дождемся пока все установим..
    q_issued.then( () => {
      for (let alfa=0; alfa <= 360; alfa+=10)
        step( alfa, alfa )
    } )
  } // кстати а что насчет рендеринга с разных позиций? ну надо чтобы тогда image отличалась да и все..

  
  // TEST рендерим потактово ожидаем когда старый закончится
  if (process.env.TEST) {
    let alfa = 0;
    let wait=false
    function step() {
      if (wait) return
      if (alfa > 360 && !process.env.FOREVER) {
        console.log("test mode: loop finished, exiting")
        process.exit(0)
      }
      alfa += 10;
      camera_pos = [ Math.cos( alfa*Math.PI/180 ), Math.sin( alfa*Math.PI/180 ), 5 ]
      console.log("test mode: submitting render")
      mozg.msg({label:"render"})
      wait = true
    }

    let cnt = 0
    mozg.query("image").done( q => {
      wait = false
      console.log("see result image ",q)
      mozg.get_payloads( q.payload_info ).then( arr => {
        let imagebytes = arr[0]
        let fname = `log/image-${cnt++}.png`
        console.log("see png bytes",imagebytes,"saving to file",fname)
        writeFile( fname, imagebytes )
        // но вообще хорошо бы эта штука какую-то метку бы нам присылала.. результирующую..
        // которую бы мы вместе с render отправляли
      })
      step()
    })
    // дождемся пока все установим..
    q_issued.then( () => step() )
  } // кстати а что насчет рендеринга с разных позиций? ну надо чтобы тогда image отличалась да и все..

}
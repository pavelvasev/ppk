/////////////////////////////////////////////////// axes

// axes box рисует оси и подписи заданного размера
// size - размер
// пример: axes_box size=10;

coview-record title="Просмотр куба" type="show-cube" cat_id="process"

feature "show-cube" {
  root: visual_process 
  title="Просмотр куба"
  
  ~have-scene2d
  status="connecting"
  time_used=[0,0]
  time_used2=@{: a=@root.time_used | return `${a[0]}ms ${a[1]}kb`:}
  scene2d={
    text (m-eval {: waiting=@root.status time_used=@root.time_used2 | 
        if (typeof(waiting) == "string") return waiting
        //if (time_used > 1000) time_used = Math.ceil( time_used )
        return waiting ? "WAIT" : `${time_used}` :}) 
          style="color:lime;"
    text (read @root.time_used2 | collect-history | arr-slice -10 -1 | arr-reverse 
       //| arr-map {: val | return val.toFixed(2) :}
       | arr-join with="<br/>") style="color:white;"

    //img2: dom tag="img" dom_attr_src="http://127.0.0.1:3333/156?ct=image/png"
    //imgc: dom tag="img" dom_attr_src="http://file.lact.ru/f1/s/0/8/image/1651/235/medium_1614537001_124-p-8-marta-na-belom-fone-155.jpg?t=1678203725"
    //http://file.lact.ru/f1/s/0/8/image/1651/235/medium_1614537001_124-p-8-marta-na-belom-fone-155.jpg?t=1678203725
  }
  
  ~have-scene-env
  scene_env={ |area|

    //console-log "camera:" @area.camera.pos @area.camera.center
    // pos это положение center это look-at

    //console-log "domsize" (get_dom_size @area.dom)

    //console-log "resolved url is" (resolve_url "/file/base/client-api/web-client-api.js")
    let rapi_module = (import_js (resolve_url "/client-api/repr-ws-client-api.js"))
        rapi_url = "ws://127.0.0.1:12000" // прокся repr-ws
        rapi_proxy_url = (resolve_url "/proxy")

    xy: object 
          //url="http://file.lact.ru/f1/s/0/8/image/1651/235/medium_1614537001_124-p-8-marta-na-belom-fone-155.jpg?t=1678203725"
          pngbytes=null
          rapi=null
          waiting_response=false // жду картинку
          new_request_pending=false // надо послать еще координаты
          
          //{{ console-log-life }}

    m-eval {: rapi_url=@rapi_url rapi_module=@rapi_module output_cell=(param @xy "rapi") | 
      rapi_module.connect("show-cube",rapi_url).then(rapi => {
        output_cell.set( rapi )

        //rapi.on('close',() => {})
      })
    :}

    m-eval {: rapi=@xy.rapi emit_render=(get-event-cell @xy "request_render") |
      if (rapi) {
          //console.log(333333)
          setTimeout( () => emit_render.set(true), 100 )
        }
    :}

    connect (param @xy "waiting_response") (param @root "status")

    reaction @xy.request_render {: rr rapi=@xy.rapi 
               pos=@area.camera.pos look_at=@area.camera.center 
               sz = (get_dom_size @area.dom)
               waiting=@xy.waiting_response
               output_cell_w=(param @xy "waiting_response") 
               output_cell_w2=(param @xy "new_request_pending") 
               xy=@xy
               |
        //console.log("rrrrrrrr",{rr,rapi,waiting})
        if (!rapi) return
        if (waiting) {
           //console.log("not sending camera-params - waiting for response")
           output_cell_w2.set( true )
           return
        }
        //console.log("reaction 22 setting new_request_pending to false")
        output_cell_w2.set( false )
        if (xy.timing) clearTimeout( xy.timing )
        xy.timing = setTimeout( () => {
          let msg = {label: 'camera_params', camera_pos: pos, camera_look_at: look_at, width: Math.floor(sz.width), height: Math.floor(sz.height)}
          console.log(msg)
          output_cell_w.set( performance.now() )
          rapi.msg( msg )
          xy.timing = null
        }, 300 )
    :}

    m-eval {: pos=@area.camera.pos look_at=@area.camera.center sz=(get_dom_size @area.dom) o_cell=(param @xy "request_render") | 
        //console.log('reaction 44', {pos,look_at})
        o_cell.set(true)
    :}

    m-eval {: waiting=@xy.waiting_response pending=@xy.new_request_pending 
       o_cell=(param @xy "request_render") |
       //console.log('m-reaction 55', {waiting,pending})
       if (!waiting && pending)
           o_cell.set(true)
    :}

    m-eval {: rapi=@xy.rapi output_cell=(param @xy "pngbytes") 
              output_cell_w=(param @xy "waiting_response") 
              rapi_proxy_url=@rapi_proxy_url
              tm_used=(param @root "time_used")
              | 
        if (!rapi) return
        console.log("waiting image")
        rapi.query("image").done(q => {
          console.log("image arrived, fetching",q)
          let urla = rapi_proxy_url + "?url="+q.payload_info[0].url + "%3Fct=image/png"
          // %3F это закодированный ?
          fetch( urla ).then( resp => {
            return resp.blob()
          }).then( bloba => {
            console.log('blob arrived',bloba)
            output_cell.set( bloba )
            let tm_used_value = performance.now() - output_cell_w.get() 
            //tm_used.set( `${Math.ceil(tm_used_value)}ms ${Math.ceil(bloba.size/1024)}kb` )
            tm_used.set( [Math.ceil(tm_used_value),Math.ceil(bloba.size/1024)] )
            output_cell_w.set( false )  
          })

        })
      :}


    m-eval {: pngbytes=@xy.pngbytes scene=@area.threejs_scene_node THREE=(threejs_module) |
      // https://stackoverflow.com/a/41752791  
      // https://stackoverflow.com/questions/19865537/three-js-set-background-image
      
      // pngbytes есть ArrayBuffer
      if (!pngbytes) {
        console.error("pngbytes is not!",pngbytes)
        return
      }
      //var imageBlob = new Blob([pngbytes], {type: "image/png"});
      var imageBlob = pngbytes

      console.time("createImageBitmap")
      createImageBitmap(imageBlob,{imageOrientation:'flipY'}).then(function(imageBitmap) {
        console.timeEnd("createImageBitmap")
        // если смена размеров экрана то приехали
        if (scene.background && scene.background.image && 
           (scene.background.image.width != imageBitmap.width || scene.background.image.height != imageBitmap.height))
           {
             console.log("disposing old texture - size differs")
             scene.background.dispose()
             scene.background = null
           }

        if (!scene.background?.created_by_ppk) {
          scene.background = new THREE.Texture();
          scene.background.created_by_ppk = true
        }
        scene.background.image = imageBitmap  
        scene.background.needsUpdate = true
        
        //const texture = new THREE.Texture(); // todo optimize
        //texture.image = imageBitmap;
        //texture.needsUpdate = true;
        //scene.background = texture
      });
      
      :}
    //text "555"
    //img2: dom tag="img" dom_attr_src="http://127.0.0.1:3333/156?ct=image/png"
    //imgc: dom tag="img" dom_attr_src="http://file.lact.ru/f1/s/0/8/image/1651/235/medium_1614537001_124-p-8-marta-na-belom-fone-155.jpg?t=1678203725"
    //http://file.lact.ru/f1/s/0/8/image/1651/235/medium_1614537001_124-p-8-marta-na-belom-fone-155.jpg?t=1678203725
  }  
  {
    gui {
      gui-tab "main" {
        gui-slot @root "ppk_ws_url" gui={ |in out| gui-string @in @out }
      }
    }
  }
}

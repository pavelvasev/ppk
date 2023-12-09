/*
  
  Показываем разворачивание нидсы на оси Y=runner
  цветом
  
  Показываем график кол-ва

  идеи - показывать не во времени а просто по порядку.
  ну или сдвигать время как-то. но там проблема что могут прийти события которые были "раньше".
  ну да, они пришли позже, просто произошли раньше но долго шли почему-то.
  и если делать по-порядку, то надо еще тогда в графике при подсчете использовать другую какую-то сетку при подсчете
*/

coview-category title="PPK" id="ppk" ~primary-cat

group {
  coview-record title="Связь с ППК" type="ppk-connection"
  coview-record title="Построить таблицу Needs" type="collect-needs"
  coview-record title="Просмотр Needs" type="show-needs"
  coview-record title="Просмотр графика Needs" type="show-needs-gr"
  coview-record title="Сцена: Needs" type="ppk-vid2"
} | assign-params (dict cat_id="ppk")
// идея мб функцию передавать и типа вот вычисление значения - title, type

load "ppk.cl"

feature "ppk-vid2" 
{
  root: 
  visual_process title="Сцена: Needs"
  {
    a: ppk-connection
    b: collect-needs ppk=@a.output
    c: show-needs needs_table=@b.output

    show-needs-gr needs_table=@b.output
      {{ effect3d_pos z=50 }}
      {
        qq: axes_view size=10
        assign-params input=@qq.axes_titles (dict names="t count type")
        //console-log "@qq.axes_titles=" @qq.axes_titles
      }
  }
}  


    jsfunc "fix_time" {: ri state |
       if (ri && !state) { 
         console.error("ri is, state is not",ri,state)
       }
       if (!state) return
       if (state.t0 == null) state.t0 = ri.msg.timestamp
       ri.msg.timestamp_orig = ri.msg.timestamp
       ri.msg.timestamp -= state.t0
       return ri
    :}


// вход: ppk - ppk
// выход output - построенная таблица
feature "collect-needs" {
  root: 
  process title="Построение таблицы needs"
  input= null // ppk
  output=@needs
  {
    param-info "ppk"  in=true out=true
    param-info "output" out=true

    gui {
      gui-tab "main" {
        gui-slot @root "ppk"  gui={ |in out| gui-string @in @out }
        gui-slot @root "output" gui={ |in out| gui-df @in @out }
      }
    }

    ///////////////////////////////////////

    let state=(m-eval {: return { ri:{}, nc: {}, rc: {}, history: {}, counter: {}, prevline: {} } :})

    let get_z={: id hint state=@state |
        let need_z = hint?.coview?.Z
        if (need_z == null) {
          if (state.nc[ id ] == null) {
            need_z = Math.random() * 10
            state.nc[ id ] = need_z
          } else need_z = state.nc[ id ]
        } else state.nc[ id ] = need_z // запомним
        return need_z
    :}

    let get_runner_coord = {: runner_id state=@state |
          let runner_y = state.rc[ runner_id ]
          if (runner_y == null) {
            runner_y = state.rc[ runner_id ] = Object.keys(state.rc).length+1
          }
          return runner_y
        :}

    ///////////////////////////////////////

    k2: object ri=(ppk-query-many ["runner-info"] input=@root.ppk | fix_time @state asap=true)

    let needs = (reaction @k2.ri {: runner_info state=@state |
      let msg = runner_info?.msg
      if (!msg) return []
      //console.log('RI arrived=',msg)
      //let prev_needs = state.ri[ msg.runner_id ] || {}
      let prev = state.history[ msg.runner_id ] || {} // прыдыдущее состояние раннера
      //console.log("runner_info arrived",runner_info)
      let rneeds = msg.deployed_needs_ids
      state.history[ msg.runner_id ] = rneeds

      let res = []
      Object.keys( rneeds ).forEach( need_id => {
        let need_rec = rneeds[ need_id ]
        // запланированные нидсы не показываем пока. там и z-ки нету.
        if (need_rec.planned_for_task) return
        
        let z = this._.get_z( need_id,need_rec.hint )
        let y = this._.get_runner_coord( msg.runner_id )
        let line = { X: msg.timestamp, T_SECOND_INT: Math.floor( msg.timestamp / 1000 ),
                     X5: state.counter[ need_id ], Y: y, Z: z, R:1,G:1,B:1,
                       NEEDID: need_id, RUNNERID: msg.runner_id, TASKID: msg.solved_task_id
                   }

        res.push( line )
      })
 
      // удалим запись если нидсу стерли
      res = res.concat( Object.keys( prev ).map( need_id => {
        let cur = rneeds[ need_id ]
        //let prev_rk = need_id + runner_info.msg.runner_id
        if (!cur) { // стерли!
          let need_rec = prev[ need_id ]
          //console.log("I see need_id was deleted!",need_id, runner_info.msg.runner_id, runner_info )
          //res.push( {...state.prevline[ prev_rk ],R:1,G:0,B:0} )
          //state.prevline[ prev_rk ] = null
           let z = this._.get_z( need_id, need_rec.hint )
           let y = this._.get_runner_coord( msg.runner_id ) 
           let line = { X: msg.timestamp, X5: state.counter[ need_id ], Y: y, Z: z, R:1,G:0,B:0,
                        T_SECOND_INT: Math.floor( msg.timestamp / 1000 ),
                        NEEDID: need_id, RUNNERID: msg.runner_id, STATUS: 'deleted', TASKID: msg.solved_task_id
                      }
           return line
        }
      }).filter( item => item ) )
      
      res.forEach( line => {
        //line.RADIUS = 1

        let prev_rk = line.NEEDID + line.RUNNERID
        let prevline = state.prevline[ prev_rk ] // предыдущее состояние этой нидсы на этом раннере
        if (prevline) {
          let reused = (msg.deployed_needs_ids[ line.NEEDID ]?.touched_by_task == msg.solved_task_id)
          line.STATUS ||= reused ? 'reused' : 'keep'
          line.X2 = prevline.X
          line.Y2 = prevline.Y
          line.Z2 = prevline.Z
          if (line.STATUS == 'keep') {
            line.R = 0
            line.G = 0
            line.B = 1
          } else if (line.STATUS == 'reused') {
            line.R = 0
            line.G = 1
            line.B = 1
            //line.RADIUS=1.52
            line.Y += 0.2
          }
        } else {
          // появилась
          line.STATUS ||= 'deployed'
          line.X2 = line.X
          line.Y2 = line.Y
          line.Z2 = line.Z
          line.R = 0
          line.G = 1
          line.B = 0
        }
        state.prevline[ prev_rk ] = line.STATUS == 'deleted' ? null : line

        return line
      });

      return res

    :} | filter {: v | return v.length>0 :}  | collect-history | arr-flat | df_create_from_rows)
  }
}

feature "ppk-connection" {
  root: process 
  title = "Связь с PPK"
  url = "ws://127.0.0.1:12000"
  status="connecting"
  ~have-scene2d
  scene2d={
    text @root.status style="color:lime;"
  }
  output=@ppk
  {
    let ppk = (ppk-connect url=@root.url)
    m-eval {: o=@ppk st=(param @root "status") | st.set( o ? "connected" : "not connected") :}

    param-info "output" out=true

    gui {
      gui-tab "main" {
        gui-slot @root "url" gui={ |in out| gui-string @in @out }
        gui-slot @root "status" gui={ |in out| gui-label @in @out }
      }
    }
  }
}

/* показывает нидсы
*/
feature "show-needs" {
  root: visual_process 
  title="Просмотр Needs"
  time_used=0
  tscale=0.0001
  needs_table=null
  ~have-scene2d
  scene2d={
    text style="color:white;" @{: ci=@clicked_info |
      return `need: ${ci.NEEDID[0]}<br/>status: ${ci.STATUS[0]}<br/>taskid: ${ci.TASKID[0]}<br/>runner: ${ci.RUNNERID[0]}`
      //"selected_need"
    :}
  }  
  {
    param-info "needs_table"  in=true out=true
    param-info "tscale" in=true out=true
    
    gui {
      gui-tab "main" {
        gui-slot @root "needs_table" gui={ |in out| gui-df @in @out }
        gui-slot @root "tscale" gui={ |in out| gui-slider min=0.0001 max=0.01 step=0.0001 @in @out }
      }
    }

    let needs=@root.needs_table

    cvneeds: cv_df (read @needs | df_mul X=@root.tscale X2=@root.tscale) title="Таблица needs"

    //needs_pts: cv_points input=(read @needs | df_mul X=@root.tscale) title="Точки needs" radius=20
    needs_pts: cv_points input=@cvneeds.output title="Точки needs" radius=20
    cv_lines input=@cvneeds.output title="Отрезки needs"
     //{ effect3d-disable-clicks }

    /// кликать по нидсам
    // кликать по точкам раннера..
    let clicked_info = (df-slice input=@needs count=1 
      start=(m-eval input=(event @needs_pts "click_3d" | get-value) 
        {: evt df=@needs |
          console.log("click3d!",evt)
          let row = df.get_row( evt.intersect.index )
          console.log(row)
          return evt.intersect.index
        :}) )// | df-convert {: df index row | return {...row,TITLE:`${row.NEEDID}`} :} ) //\n${row.STATUS}
//    callouts radius=10 size=10
//        input=(@clicked_info | df_mul X=@root.tscale X2=@root.tscale) delta=[0,0.5,0]
    spheres input=(@clicked_info | df_mul X=@root.tscale X2=@root.tscale) radius=0.25
      { effect3d-disable-clicks }

  }

}

/* показывает суммарный график использования нидсов
*/
feature "show-needs-gr" {
  root: visual_process 
  title="График Needs"
  time_used=0
  tscale=0.0001
  needs_table=null
  {
    param-info "needs_table"  in=true out=true
    param-info "tscale" in=true out=true
    
    gui {
      gui-tab "main" {
        gui-slot @root "needs_table" gui={ |in out| gui-df @in @out }
        gui-slot @root "tscale" gui={ |in out| gui-slider min=0.0001 max=0.01 step=0.0001 @in @out }
      }
    }

    let statuses=["keep","deployed","deleted","reused"]
    let statuses_colors=[ [0,0,1], [0,1,0], [1,0,0], [0,1,1]]

    let k = (read @root.needs_table | @{: input df=(df-create) statuses=@statuses | 
           df = df.clone()
           let cols = {}
           let thus_cols = {}
           statuses.forEach(s=> {
              cols[s] = new Map()
              thus_cols[s] = []
           })
           
           let xvals = new Set()
           
           for (let i=0; i<input.length; i++) {
              let x = Math.floor(input.X[i]/1000)*1000
              xvals.add( x )
              let line_status = input.STATUS[i]
              let cur_value = cols[ line_status ].get(x) || 0
              if (!cols[ line_status ].has( x ))
                 cols[ line_status ].set( x, new Set() )
              cols[ line_status ].get( x ).add( input.NEEDID[i] + input.RUNNERID[i] )
           }
           

           let sorted_x_vals = [...xvals.values()].sort( (a,b) => a-b)
           //console.log({sorted_x_vals})
           df.add_column("X",sorted_x_vals)
           
           for (let x of sorted_x_vals) {
              statuses.forEach(s => {
                thus_cols[s].push( cols[s].has(x) ? cols[s].get(x).size : 0 )
              })
           }           
           Object.keys(cols).forEach( (k) => {
             df.add_column(k, thus_cols[k])
           })
           return df
        :})
    

    cvneeds: cv_df @k title="Таблица подсчёта needs"

    read @statuses | repeater { |status index|
      //needs_pts: cv_points input=@cvneeds.output title="Точки needs" radius=20
      
       qq: cv_linestrip
          input=(read @k | df_mul X=@root.tscale | df_set Z=(@index) Y=("->" + @status))
          title=("Ломаная " + @status)
          radius=3
       { 
          read @qq | assign-params (dict color=(read @statuses_colors | geta @index))

          text_sprite_one text=@status 
            position=(m-eval {: index=@index | return [-3,4-index,index] :})
            radius=10 size=30 color=@qq.color
       }
        

    }

  }

}

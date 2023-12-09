/*
  Показываем задачи (в момент хм.. создания? назначения? решения?)
  на оси Y=0
  
  Показываем разворачивание нидсы на оси Y=-runner
  Показываем связь задачи с разворачиванием нидсы
  Показываем связь задачи с удалением нидсы
  
  Наслаждаемся
*/

coview-category title="PPK" id="ppk" ~primary-cat

/*
coview-record title="Связь с ППК" type="ppk-connection" cat_id="ppk"
coview-record title="Сбор Needs" type="collect-needs" cat_id="ppk"
coview-record title="Просмотр Needs" type="show-needs" cat_id="ppk"
coview-record title="Просмотр графика Needs" type="show-needs-gr" cat_id="ppk"
*/

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
        }
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
      if (!msg) return
      //console.log('RI arrived=',msg)
      //let prev_needs = state.ri[ msg.runner_id ] || {}
      let prev = state.history[ msg.runner_id ] || {} // прыдыдущее состояние раннера
      //console.log("runner_info arrived",runner_info)
      let rneeds = msg.deployed_needs_ids
      state.history[ msg.runner_id ] = rneeds

      let res = Object.keys( rneeds ).map( need_id => {
        let need_rec = rneeds[ need_id ]
        
        let z = this._.get_z( need_id,need_rec.hint )
        let y = this._.get_runner_coord( msg.runner_id )
        let line = { X: msg.timestamp, X5: state.counter[ need_id ], Y: y, Z: z, R:1,G:1,B:1,
                       NEEDID: need_id, RUNNERID: msg.runner_id, TASKID: msg.solved_task_id
                   }

        return line
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
                        NEEDID: need_id, RUNNERID: msg.runner_id, STATUS: 'deleted', TASKID: msg.solved_task_id
                      }
           return line
        }
      }).filter( item => item ) )
      
      res.forEach( line => {
        let prev_rk = line.NEEDID + line.RUNNERID
        let prevline = state.prevline[ prev_rk ] // предыдущее состояние этой нидсы на этом раннере
        if (prevline) {
          line.STATUS ||= 'keep'
          line.X2 = prevline.X
          line.Y2 = prevline.Y
          line.Z2 = prevline.Z
          if (line.STATUS == 'keep') {
            line.R = 0
            line.G = 0
            line.B = 1
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

feature "show-needs" {
  root: visual_process 
  title="Просмотр Needs"
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

    let needs=@root.needs_table

    cvneeds: cv_df (read @needs | df_mul X=@root.tscale X2=@root.tscale) title="Таблица needs"

    //needs_pts: cv_points input=(read @needs | df_mul X=@root.tscale) title="Точки needs" radius=20
    needs_pts: cv_points input=@cvneeds.output title="Точки needs" radius=20
    cv_lines input=@cvneeds.output title="Отрезки needs"

  }

}

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

    let count_needs_ca=(@root.needs_table
      | df_map {: df index row | 
      return {...row,X: Math.floor(row.X/1000)*1000} // посекундная тарификация
    :} | df-split column="STATUS") 


    read @count_needs_ca | repeater { |rec index|
      //needs_pts: cv_points input=@cvneeds.output title="Точки needs" radius=20
      mmm: cv_linestrip 
        input=@cvneeds.output 
        title=("Ломаная счетчика needs " + @status)
        color=(m-eval {: df=@df |
          return [df.R[0], df.G[0], df.B[0] ]
          :} | pause_input | console-log-input "COLOR=")
        //{{ console-log-life }}
      {      
        let status = @rec.0 df = @rec.1

        let k = (read @df | df-index column="X"
        | convert {: input df=(df-create)| 
           df = df.clone()
           df.add_column("X", Object.keys( input ).map( v => parseInt(v)))
           df.add_column("COUNT", Object.keys( input ).map( k => input[k].length ))
           return df
        :})

        // todo Z посадить таки на номер rec (modelIndex?)
        cvneeds: cv_df (read @k | df_set Z=(@index + 70) Y="->COUNT"
                      | df_mul X=@root.tscale X2=@root.tscale) 
               title="Счетчик needs"
       }
    }

/*
    cvneeds: cv_df (read @df | df_set Z=0 Y="->COUNT"
                    | df_mul X=@root.tscale X2=@root.tscale) 
             title="Счетчик needs"

    //needs_pts: cv_points input=@cvneeds.output title="Точки needs" radius=20
    cv_linestrip input=@cvneeds.output title="Отрезки счетчика needs"
*/    

  }

}

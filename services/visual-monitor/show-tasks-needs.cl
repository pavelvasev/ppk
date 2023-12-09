/*
  Показываем задачи (в момент хм.. создания? назначения? решения?)
  на оси Y=0
  
  Показываем разворачивание нидсы на оси Y=-runner
  Показываем связь задачи с разворачиванием нидсы
  Показываем связь задачи с удалением нидсы
  
  Наслаждаемся
*/

coview-record title="Просмотр Tasks-Needs" type="show-tasks-needs" cat_id="process"

load "ppk.cl"

feature "filter" {: env |
  env.trackParam("input", v => {
    let f = env.params[0]
    if (f?.bind && f(v)) {
      env.setParam("output",v)
    }
  })
:}

feature "fapply" {: env |
  env.trackParam("input", v => {
    let f = env.params[0]
    if (f?.bind) {
      let r = f(v)
      env.setParam("output",r)
    }
  })
:}

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

/* все-таки мб ввести сигнал updated а там уж какой он был -changed или assigned - пусть от ячейки зависит
*/
feature "collect-history" {: env |
  let acc = []
  env.trackParam("input",(val) => {
    acc.push( val )
    env.setParam("output",acc.slice(0) ) // slice - чтобы оно менялось.. хех..
  })
:}

feature "show-tasks-needs" {
  root: visual_process 
  title="Просмотр Tasks-Needs"
  url = "ws://127.0.0.1:12000"

  ~have-scene2d
  status="connecting"
  time_used=0
  tscale=0.0001
  scene2d={
    text @root.status style="color:lime;"
  }
  {
    gui {
      gui-tab "main" {
        gui-slot @root "url" gui={ |in out| gui-string @in @out }
        gui-slot @root "tscale" gui={ |in out| gui-slider min=0.0001 max=0.01 step=0.0001 @in @out }
      }
    }

    let ppk = (ppk-connect url=@root.url)
    m-eval {: o=@ppk st=(param @root "status") | st.set( o ? "connected" : "not connected") :}

    // l0: ppk-query-many ["runner-info"] input=@ppk
    k2: object ri=(ppk-query-many ["runner-info"] input=@ppk | fix_time @state asap=true)
    //let c1=(ppk-query-many ["runner-info"] input=@ppk | fix_time @state asap=true)

    let needs = (reaction @k2.ri {: runner_info state=@state |
      let msg = runner_info?.msg
      if (!msg) return
      //console.log('NS=',msg)
      //let prev_needs = state.ri[ msg.runner_id ] || {}
      let prev = state.history[ msg.runner_id ] || {} // прыдыдущее состояние раннера
      //console.log("runner_info arrived",runner_info)
      let rneeds = msg.deployed_needs_ids
      state.history[ msg.runner_id ] = rneeds

      let res = Object.keys( rneeds ).map( need_id => {
        let need_rec = rneeds[ need_id ]
        //let prev_rk = need_id + runner_info.msg.runner_id
        //let prevline = state.prevline[ prev_rk ] // предыдущее состояние этой нидсы на этом раннере
        if (!prev[ need_id ]) { // это развертывание - действуем
        // а всегда будем для интересу.. показывать нидсу
           state.counter[ need_id ] = (state.counter[need_id] || 0) + 1
           
           let z = this._.get_z( need_id,need_rec.hint )
           let y = 5 //get_runner_y( runner_info.msg.runner_id )
           let line = { X: msg.timestamp, X5: state.counter[ need_id ], Y: y, Z: z, R:1,G:1,B:1,
                        NEEDID: need_id, RUNNERID: msg.runner_id, STATUS: 'deployed', TASKID: msg.solved_task_id
                      }
           return line
        }
      }).filter( item => item )
      
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
           let y = 5
           let line = { X: msg.timestamp, X5: state.counter[ need_id ], Y: y, Z: z, R:1,G:0,B:0,
                        NEEDID: need_id, RUNNERID: msg.runner_id, STATUS: 'deleted', TASKID: msg.solved_task_id
                      }
           return line
        }
      }).filter( item => item ) )
      
      return res

    :} | filter {: v | return v.length>0 :}  | collect-history | arr-flat | df_create_from_rows)
    //let needs = (df_create | df_set X=0 Y=0 Z=0 STATUS="")

    let task_assigned = (ppk-query-many ["runner-started"] input=@ppk)
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
    
    //let needs_created // x,y,z,taskid
    //let needs_removed // x,y,z,taskid
    
    // надо: найти пары needs_created, task_record и составить их подряд

    // задачки в форме таблицы
    let r_collected = (read @task_assigned | fix_time @state asap=true | m-eval asap=true {: runner_info state=@state |
      if (!runner_info) return; // чет я не понимаю
      let msg = runner_info.msg
      //console.log({msg})
      
      let x = msg.timestamp
      let y = 10
      let z = this._.get_z( msg.id, msg.hint )
      let line = { X:x, Y:y, Z:z, TASKID: msg.id, RUNNERID: msg.runner_id }
      return line
    :} | filter {: v | return v :} | collect-history)
    
    console_log "r=" @r_collected "needs=" @needs
    
    let tasks= (df_create_from_rows input=@r_collected)
    cvtasks: cv_df (read @tasks | df_mul X=@root.tscale X2=@root.tscale) title="Таблица tasks"
    cvneeds: cv_df (read @needs | df_mul X=@root.tscale X2=@root.tscale) title="Таблица needs"

/*
    xx: let needs = (df_create | df_set X=0 Y=0 Z=0)
    reaction (param @r_append) {: needs_c = (param @xx "needs" |
    :}
*/
/*
    // что-то типа такого:
    create_from_arrays
    let needs = (df_create | df_set X=0 Y=0 Z=0)
    read @needs | df_append_rows @r_append | df_shallow_clone | write &needs
*/    

    //needs_pts: cv_points input=(read @needs | df_mul X=@root.tscale) title="Точки needs" radius=20
    needs_pts: cv_points input=@cvneeds.output title="Точки needs" radius=20
    tasks_pts: cv_points input=@cvtasks.output title="Точки tasks" radius=20
    tasks_needs: cv_lines input=@task2needs title="Tasks-needs" radius=2

    let taskindex =(df_index input=@cvtasks.output column="TASKID")
    let task2needs = (read @cvneeds.output | df_convert {: df index row ind=@taskindex tasks=@cvtasks.output |

      let task_ind = ind[ row.TASKID ]
      if (!task_ind) return {...row,X2:row.X,Y2:row.Y,Z2:row.Z,TS:"mis"}
      let task = tasks.get_row( task_ind[0] )
      if (!task) return {...row,X2:row.X,Y2:row.Y,Z2:row.Z,TS:"mis"}
      
      return {...row, X2: task.X, Y2: task.Y, Z2: task.Z,TS:"ok"}
    :})

  }
}

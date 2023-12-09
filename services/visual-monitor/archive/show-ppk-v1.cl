// версия 22.03 вечерняя, первая (ванты)

coview-record title="Просмотр PPK" type="show-ppk" cat_id="process"

feature "ppk-connect" {
  root: object url = "ws://127.0.0.1:12000" id="show-ppk" {
    let rapi_module = (import_js (resolve_url "/client-api/repr-ws-client-api.js"))
    m-eval {: id=@root.id rapi_url=@root.url rapi_module=@rapi_module output_cell=(param @root "output") | 
      rapi_module.connect(id,rapi_url).then(rapi => {
        output_cell.set( rapi )
      })
    :}
  }
}

feature "ppk-query" {
  root: object "test" {
    m-eval {: ppk=@root.input crit=@root.0 output_cell=(param @root "output") obj=@root |
      //if (obj.unsub)
      ppk.query( crit ).done( msg => {
        output_cell.set( msg )
      })
    :}
  }
}

feature "show-ppk" {
  root: visual_process 
  title="Просмотр PPK"
  url = "ws://127.0.0.1:12000"
  
  ~have-scene2d
  status="connecting"
  time_used=0
  tscale=0.0001
  scene2d={
    text @root.status style="color:lime;"
  }
  tasks=(df-create | df_set X=0 Y=0 Z=0  T=0 R=0 G=0 B=0 ID="" HINT="")
  runners=(df-create | df_set X=0 Y=0 Z=0 X2=0 Y2=0 Z2=0  T=0 R=0 G=0 B=0 ID="" HINT="")
  tfinish=(df-create | df_set X=0 Y=0 Z=0 X2=0 Y2=0 Z2=0  T=0 R=0 G=0 B=0 ID="" HINT="")

//  ~have-scene-env
//  scene_env={ |area|  }
  {
    gui {
      gui-tab "main" {
        gui-slot @root "url" gui={ |in out| gui-string @in @out }
        gui-slot @root "tscale" gui={ |in out| gui-slider min=0.0001 max=0.01 step=0.0001 @in @out }
      }
    }
    
    ppk: ppk-connect url=@root.url
    reaction @ppk.output {: o st=(param @root "status") | console.log('o=',o); st.set( o ? "connected" : "not connected") :}
    
    q1: ppk-query "exec-request" input=@ppk.output
    //console-log "see exec-request" @q1.output
    re: reaction @q1.output {: msg dat=(param @root "tasks") state=@re |
      console.log("see msg",msg)
      

      let t = msg.timestamp || performance.now()
      if (!state.t0) state.t0 = t
      
      let scale = 1 / 1000.0
      let x = (t - state.t0) //*scale
      
      let a = dat.get().clone()
      


      let RGB=[1,1,1]
      let word = msg.hint.split(" ")[0]
      if (word == "render") RGB=[1,0,0]
      if (word == "generate") RGB=[0,0,1]

      let r = 10
      let z = Math.random()*20
      
      //word = msg.hint.split("Z=")[1]
      //if (word) z = parseFloat(word)      
      let line = {X:x, Y:10, Z:z, ID: msg.id, HINT: msg.hint,T:t, R:RGB[0],G:RGB[1],B:RGB[2], ...(msg.cohint || {}) }
      
      a.append_row( line )
      console.log("setting df",a)
      
      dat.set( a )
      
      state.tasks ||= {}
      state.tasks[ msg.id ] = line
    :}
    
    tasks_pts: cv_points input=(read @root.tasks | df_mul X=@root.tscale) title="Точки задач"

    q2: ppk-query "runner-info" input=@ppk.output
    //console-log "see exec-request" @q1.output
    re: reaction @q2.output {: msg dat=(param @root "runners") state=@re |
      console.log("see runner-info msg",msg)
      
      let t = msg.timestamp || performance.now()
      if (!state.t0) state.t0 = t
      let x = (t - state.t0) //*scale
      
      state.runners_pos ||= {}
      if (!state.runners_pos[ msg.task_label ]) {
        state.runners_pos[ msg.task_label ] = {z:1 + Object.keys( state.runners_pos ).length, x}
      }
      let rp = state.runners_pos[ msg.task_label ]
      let xprev = rp.x
      rp.x = x

      let a = dat.get().clone()

      let RGB=[1,1,1]
//      let word = msg.hint.split(" ")[0]
//      if (word == "render") RGB=[1,0,0]
//      if (word == "generate") RGB=[0,0,1]

      let r = 10
      let z = rp.z
      
      //word = msg.hint.split("Z=")[1]
      //if (word) z = parseFloat(word)      
      let line = {X:x, Y:0, Z:z, X2: xprev, Y2:0, Z2:z,
                  ID: msg.task_label, T:t, R:RGB[0],G:RGB[1],B:RGB[2], ...(msg.cohint || {}) }
      
      a.append_row( line )
      //console.log("setting df",a)
      
      dat.set( a )
      
      ////////////////////
    :}
    
    
    
    cv_points input=(read @root.runners | df_mul X=@root.tscale) title="Точки runner-info"
    cv_lines input=(read @root.runners | df_mul X=@root.tscale X2=@root.tscale) title="Отрезки работ"
    
    
    q3: ppk-query "runner-finished" input=@ppk.output
    //console-log "see exec-request" @q1.output
    re: reaction @q3.output {: msg dat=(param @root "tfinish") state=@re |
      console.log("see runner-finished msg",msg)
      
      let t = msg.timestamp || performance.now()
      if (!state.t0) state.t0 = t
      let x = (t - state.t0) //*scale
      
      state.runners_pos ||= {}
      if (!state.runners_pos[ msg.runner_id ]) return
      let rp = state.runners_pos[ msg.runner_id ]
      let a = dat.get().clone()

      let RGB=[1,1,1]
      
      let task = (state.tasks || {})[ msg.id ] || {X:x, Y:0, Z:rp.z} // по умолчанию не рисуем

      let line = {X:x, Y:0, Z:rp.z, X2: task.X, Y2: task.Y, Z2: task.Z,
                  ID: msg.task_label, T:t, R:RGB[0],G:RGB[1],B:RGB[2], ...(msg.cohint || {}) }
      
      a.append_row( line )
      //console.log("setting df",a)
      
      dat.set( a )
      
      ////////////////////

    :}    
    
    lin: cv_lines input=(read @root.tfinish | df_mul X=@root.tscale X2=@root.tscale) title="Отрезки завершения задач" color=[0,1,0]
    cv_points input=(read @root.tfinish | df_mul X=@root.tscale) title="Точки завершения задач" color=[0,1,0]
    
    lin2: cv_lines input=(read @root.tfinish | df_mul X=@root.tscale X2=@root.tscale | df_filter {: df index | return df.Z2[index] == 1.0 :})
       title="Отрезки завершения задач Z0" color=[1,1,0]
    
  }
}

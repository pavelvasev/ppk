// первая версия с зависимостями

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

// ppk-query-many ["runner-info","runner-started","runner-finished"]
feature "ppk-query-many" {
  root: object "test" {
    m-eval {: ppk=@root.input critarr=@root.0 output_cell=(param @root "output") obj=@root |
      //if (obj.unsub)
      for (let crit of critarr) {
        ppk.query( crit ).done( msg => {
          output_cell.set( { crit, tm:performance.now(), msg:msg} )
        })
      }
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
  tasks=(df-create | df_set X=0 Y=0 Z=0 X2=0 Y2=0 Z2=0 T=0 R=0 G=0 B=0 ID="" TITLE="" STATE="") // поставлены
  twait=(df-create | df_set X=0 Y=0 Z=0 X2=0 Y2=0 Z2=0 T=0 R=0 G=0 B=0 ID="" TITLE="" STATE="") // ожидают resolve
  tpending=(df-create | df_set X=0 Y=0 Z=0 X2=0 Y2=0 Z2=0 T=0 R=0 G=0 B=0 ID="" TITLE="" STATE="")  // ожидают назначения
  runners=(df-create | df_set X=0 Y=0 Z=0 X2=0 Y2=0 Z2=0  T=0 R=0 G=0 B=0 ID="" RUNNER_ID="" STATE="" TASK_ID="" TITLE="") // состояния раннера
  tfinish=(df-create | df_set X=0 Y=0 Z=0 X2=0 Y2=0 Z2=0  T=0 R=0 G=0 B=0 ID="" TITLE="" RUNNER_ID="" TASK_ID="") // точки завершения задач - и отрезки от раннеров к этим точкам
  twork=(df-create | df_set X=0 Y=0 Z=0 X2=0 Y2=0 Z2=0  T=0 R=0 G=0 B=0 ID="" TITLE="" RUNNER_ID="" TASK_ID="") // отрезки работы задачи
  tref=(df-create | df_set X=0 Y=0 Z=0 X2=0 Y2=0 Z2=0 T=0 R=0 G=0 B=0 ID="" TITLE="" STATE="") // resolve-ссылки на параметры задачи (п-промисы)

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
    
    q1: ppk-query-many ["exec-request","task-resolved","runner-started"] input=@ppk.output
    //console-log "see exec-request" @q1.output
    re: reaction @q1.output {: info dat=(param @root "tasks") tpending=(param @root "tpending") tref=(param @root "tref") twait=(param @root "twait") state=@re |
      let msg = info.msg
      console.log("see msg",msg)

      let t = msg.timestamp || performance.now()
      if (!state.t0) state.t0 = t
      
      let scale = 1 / 1000.0
      let x = (t - state.t0) //*scale

      let RGB=[1,1,1]
      let word = (msg.hint?.text || "").split(" ")[0]
      if (word == "render") RGB=[1,0,0]
      if (word == "generate") RGB=[0,0,1]

      let r = 10
      let z = Math.random()*20
      
      //word = msg.hint.split("Z=")[1]
      //if (word) z = parseFloat(word)      
      let line = {X:x, Y:10, Z:z, ID: msg.id, TITLE: msg.hint?.text,T:t, R:RGB[0],G:RGB[1],B:RGB[2], STATE: info.crit, ...(msg.hint?.coview || {}) }
//      if (msg.hint?.coview?.Z)
        //line.Y = line.Y + Math.random() // визуальное различие
        
      line.Z2 = line.Z
      line.X2 = line.X
      line.Y2 = line.Y
      
      state.tasks ||= {}
      let prev = state.tasks[ msg.id ]
      
      state.tasks[ msg.id ] = line
      if (prev) {
        line.X2 = prev.X
        line.Y2 = prev.Y
        line.Z2 = prev.Z
      }
      
      if (prev) {
        line.Y = prev.Y
        line.Y2 = prev.Y2
      }
      
      let src = (info.crit == "task-resolved" ? twait : (info.crit == "runner-started" ? tpending : dat))
      let a = src.get().clone()
      a.append_row( line )
      src.set( a )
      
      if (info.crit == "task-resolved") {
        let qq = tref.get()
        line.R = 1
        line.G = 1
        line.B = 1
        let have_changes = false
        // показать наши параметры..
        for (let argname in msg.arg) {
          let v = msg.arg[ argname ]
          if (!v.p_promise) continue
          let rid = v.id
          let rit = state.tasks[ rid ]
          if (!rit) continue
          line.X2 = rit.X
          line.Y2 = rit.Y
          line.Z2 = rit.Z
          qq.append_row( line )
          have_changes = true
        }
        if (have_changes)
        tref.set( qq.clone() )
      }
      

    :}

    q3: ppk-query-many ["runner-info","runner-started","runner-finished"] input=@ppk.output
    re: reaction @q3.output {: info twork=(param @root "twork") tfinish=(param @root "tfinish") dat=(param @root "runners") state=@re |
      let msg = info.msg
      console.log("see runner-finished msg",info)

      let t = msg.timestamp || performance.now()
      if (!state.t0) state.t0 = t
      let x = (t - state.t0) //*scale

      state.runners_prev ||= {}
      let rprev = state.runners_prev[ msg.runner_id ] || {Z:1 + Object.keys( state.runners_prev ).length}
      let rcur = { X:x, Y:0, Z: rprev.Z,
                   R:1, G:1, B:1, STATE: info.crit, RUNNER_ID: msg.runner_id, TASK_ID: msg.id }

      let a = dat.get().clone()
      
      // палочки всегда
        rcur.X2 = rprev.X
        rcur.Y2 = rprev.Y
        rcur.Z2 = rprev.Z
      let task = (state.tasks || {})[ msg.id ]// || {X:x, Y:0, Z:rp.z, R:0, G:1, B:0 }// по умолчанию не рисуем
      //if (!task) return        
      if (rcur.STATE == "runner-finished" && rprev.STATE == "runner-started") {
        // закончили работу
        // палочка цвета задачи
        if (task) {
          rcur.R = task.R
          rcur.G = task.G
          rcur.B = task.B
        } else {
          // закончили работу
          // неизвестная задача
          rcur.R = 1 // чутка красная палочка
          rcur.G = 0.5
          rcur.B = 0.5
        }
      } else {
        // были в ожидании
        // палочка фиолетовая
        if (rcur.STATE == "runner-started" && rprev.state == "runner-info") {
          rcur.R = 1
          rcur.G = 0.2
          rcur.B = 1
        } else {
          // неясный случай
          rcur.R = 0
          rcur.G = 1
          rcur.B = 1
        }  
      }
      a.append_row( rcur )
      dat.set( a )
      state.runners_prev[ msg.runner_id ] = rcur
      
      if (!task) return
      
      if (rcur.STATE == "runner-finished") {
      // добавим палочку от runner-finished к задаче
      
      // от точки runner-finished к задаче
      /*
      let line = {X:x, Y:0, Z:rp.z, X2: task.X, Y2: task.Y, Z2: task.Z,
                  ID: msg.task_label, T:t, R:RGB[0],G:RGB[1],B:RGB[2], ...(msg.cohint || {}) }
      */
      // от точки runner-finished - наверх к оси задачи, и поверху - к задаче
      let RGB=[168/255.0,228/255.0,160/255.0] // бабушкины яблоки https://get-color.ru/green/
      
      // от раннера к проекции задачи
      let line = {X2:x, Y2:0, Z2:rcur.Z, X: x, Y: task.Y, Z: task.Z, R:task.R, G:task.G,B:task.B,
                  ID: msg.runner_id, T:t, ...(msg.hint?.coview || {}) }
      // к началу задачи
      let line2 = {X:x, Y:task.Y, Z:task.Z, X2: task.X, Y2: task.Y, Z2: task.Z, R:task.R, G:task.G,B:task.B,
                  ID: msg.runner_id, T:t,  ...(msg.hint?.coview || {}) }
 
      let b = tfinish.get().clone()
      b.append_row( line )
      tfinish.set( b )
      
      let c = twork.get().clone()
      c.append_row( line2 )      
      twork.set( c )
      
      //////////////////// надо сделать еще одно доброе дело - обновить стейт таски. чтобы зависимоости норм рисовалиси
      //state.tasks[ msg.id ] = line2
      task.X = x
      task.STATE = 'runner-finished'
      
      }
      
      

    :}
    
    tasks_pts: cv_points input=(read @root.tasks | df_mul X=@root.tscale) title="Точки задач"
    cv_lines input=(read @root.twait | df_mul X=@root.tscale X2=@root.tscale) title="Отрезки ожидания зависимостей задач" color=[0.5, 0.5, 0.5] visible=false
    //cv_points input=(read @root.twait | df_mul X=@root.tscale X2=@root.tscale) title="Точки ожидания задач" color=[0.5, 0.5, 0.5]
    cv_lines input=(read @root.tpending | df_mul X=@root.tscale X2=@root.tscale | df_set R=1 G=1 B=1 ) title="Отрезки ожидания назначения задач" radius=2 color=[0,0.5,0]
    
    cv_points input=(read @root.runners | df_mul X=@root.tscale | df_set R=1 G=1 B=1) title="Точки runner"
    cv_lines input=(read @root.runners | df_mul X=@root.tscale X2=@root.tscale) title="Отрезки работы runner" //color=[1,0,1]    
    
    
    lin: cv_lines input=(read @root.tfinish | df_mul X=@root.tscale X2=@root.tscale | df_set R=1 G=1 B=1) title="Отрезки завершения задач - раннеры" color=(m-eval {: return [168/255.0,228/255.0,160/255.0] :})
    
    cv_points input=(read @root.tfinish | df_mul X=@root.tscale) title="Точки завершения задач" color=[1,1,1]
    cv_lines input=(read @root.twork | df_mul X=@root.tscale X2=@root.tscale ) title="Отрезки решения задач" color=(m-eval {: return [1,1,1] :}) radius=7
    
    cv_lines input=(read @root.tref | df_mul X=@root.tscale X2=@root.tscale) title="Отрезки зависимостей" color=[1,1,1]
    console-log "TREF=" @root.tref

//    lin2: cv_lines input=(read @root.tfinish | df_mul X=@root.tscale X2=@root.tscale | df_filter {: df index | return df.Z[index] == 1.0 :})
//       title="Отрезки завершения задач Z0" color=[1,0,1]
    
  }
}

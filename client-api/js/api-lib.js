// 

import * as CL2 from "./cl2.js";

export class ClientList {
  constructor( entries ) {
     //this.records = new Map( entries.map( entry => [ entry[0], this.process_value(entry[1]) ]) )
    this.records = new Map( entries )
     //this.ondelete = () => {}

    this.changed  = CL2.create_channel()  // список поменялся

    this.setted    = CL2.create_channel() // значение установлено
    this.added    = CL2.create_channel()  // значение добавлено (а раньше не было)
    this.deleted  = CL2.create_channel()  // значение удалено
    // мб надо будет еще item-changed 
  }

  set(name,value) {
    let value_existed = this.records.has( name )
    this.records.set( name,value ) //this.process_value(value) )
    this.changed.submit( this.get_values() )    
    this.setted.submit( {name,value} )

    if (!value_existed)
      this.added.submit( {name,value} )
  }

  get_values() {
    return [...this.records.values()].map( r => r.arg )
  }

  delete(name) {
    let existing = this.records.get( name )
    /*
    if (this.ondelete) {
      if (existing)
          this.ondelete( name, existing )
    }
    */
    //console.log('list deleting id',name)
    this.records.delete(name)
    this.changed.submit( this.get_values() )

    if (existing) {
      //console.error("ClientList: deleting",{name})
      this.deleted.submit( {name, value:existing} )

      if (existing.on_delete) // F-REACTION-ON-DELETE
        existing.on_delete( existing.arg )
    }
  }

  // rapi нужно кодам реакций поэтому передаем иво
  // idea вообще говоря мы можем собрать результаты реакций и вернуть их. и это может что-то дать полезное.
  msg( m, rapi ) {
    //console.log("list msg submit: m=",m,"vals=",[...this.records.values()] );//,"this.records=",[...this.records.keys()])
    for (let reaction of this.records.values()) {
      //console.log("this reaction=",reaction)
      if (reaction.test) {
        // todo преобразование в функцию делать на set и тогда - if уйдет. и action тоже делать также.
        // if (!reaction.test.bind) reaction.test = eval( reaction.test )
        if (!reaction.test( m, reaction.arg, rapi )) continue
      }
      //if (!reaction.action.bind) reaction.action = eval( reaction.action )
      let res = reaction.action( m, reaction.arg, rapi )
      if (m.removed) break
    }
  }
}

export class ClientApi {
  constructor( websocket_fn, fetch_fn, sender, url, verbose ) {

    let ws = websocket_fn( url )
    this.ws = ws
      this.url = url
      this.websocket_fn = websocket_fn; // надо и такое для корзинки
    this.verbose = verbose
    this.sender = sender
    this.counter = 0
    this.fetch = fetch_fn

    this.client_id = this.generate_uniq_query_id("")

    //this.guid = this.generate_uniq_query_id('') // можно его от мейна получить и юзать в тч в generate_uniq_query_id 

    // видимо надо таки канал работы с сервером, типа send
    // ну и обрабатывать от нево списки
    // и далее - уже - функция добавить сообщение, добавить реакцию
    // и вот эта добавить сообщение - она не посылает а применяет все реакции из списка.
    ws.on('message', (data) => {
      let msg = JSON.parse( data )
      if (this.verbose)
        console.log("msg_from_server:",msg)
      if (msg.hello) {
        this.server_t0 = msg.server_time
      }
      else if (msg.cmd_reply== 'begin_listen_list') {
        let listp = this.lists[ msg.crit ]
        let list = new ClientList( msg.entries.map( entry => [ entry[0], this.process_reaction_value(entry[1]) ]) )
        //console.log("we ")
        listp.call_resolve( list )
      } else if (msg.cmd_reply == 'add_item')
      {
        // это ответ от сервера что он обработал наше add_item        
        this.deployed_items_resolve[ msg.id ] ()
      } else if (msg.opcode) {
        //console.log("msg opcode from center",msg)
        let listp = this.lists[ msg.crit ]
        if (!listp) {
          // бывает..
          console.error("listp is null! msg.crit",msg.crit)
          this.print()
          console.trace()
          return
        }
        listp.then( list => {
          // если будут обновления значений, то надо порядок тогда сохранять,
          // а текущее это рандомный порядок
          if (msg.opcode == 'set')
            list.set( msg.arg.name, this.process_reaction_value(msg.arg.value) )
          else if (msg.opcode == 'delete')
            list.delete( msg.arg.name )
            /* ну и что что содержимое списка кончилось - может потом появится.
            if (list.records.size == 0) {
              this.forget_list( msg.crit ) // какая-то весьма дикая оптимизация..
            }
            */
            //console.log("reporting lists after delete r."); this.print()
        })
      }
    })

  }

  print() {    
      for (let crit of Object.keys(this.lists)) {
        //console.log
        Promise.resolve( this.lists[crit] ).then( list => {
          console.log("list crit",crit,"size",list.records.size,"reactions keys", ...list.records.keys())
        })
      }                
  }

  exit() {
    this.ws.close()
    console.log("ClientApi normal exit.")
  }

  ////// обработка входящих реакций
  process_reaction_value( value ) {
    if (value?.action)
      value.action = this.prepare_action( value.action )
    if (value?.test)
      value.test = this.prepare_action( value.test )
    if (value?.on_delete) // F-REACTION-ON-DELETE
      value.on_delete = this.prepare_action( value.on_delete )
    return value
  }

  prepare_action( action_record ) {
    let res
    if (typeof(action_record) == "string") {
      /*
       if (action_record.indexOf("wait_promise"))
          {
            //console.error("WWAWAWA!",action_record)
          }
      */    
       res = eval( action_record )
    }
    else if (action_record?.js)
        res = eval( action_record.js )
    else if (action_record?.code) {
      let f = this.operations[ action_record.code ]
      if (f)
         res = (msg) => this.operations[ action_record.code ](msg,action_record.arg)  // this.operations[ action_record.code ]
      else 
         res = () => console.log("operation id=",action_record.code,"not defined!")
      // update а если позже определят?    
    }
     
    return res
  }

  lists = {}
  // возвращает "список", котоорый будет и пополнять
  // список - это список реакций, которые следуте выполнить при отправке сообщения crit
  get_list( crit ) {
    // получается это на самом деле - получить кешируемый, управляемый список
    // который к тому же сотрут в случае чего

    if (this.lists[crit]) return this.lists[crit]
    //this.lists[crit] = new ClientList()
    let resolve_fn
    let k = new Promise( (resolve,reject) => {
      // промиса потому что надо получить начальное наполнение
      resolve_fn = resolve
    })
    this.lists[ crit ] = k
    k.call_resolve = resolve_fn
    this.send( {cmd:'begin_listen_list',crit} )
    return k
  }

  // перестать слушать список
  forget_list( crit ) {
    delete this.lists[ crit ]
    this.send( {cmd:'end_listen_list',crit} )
  }

  // это коммуникация с сервером
  send( json ) {
    if (this.verbose)
      console.log("send-to-server:",json)
    this.ws.send( JSON.stringify(json) )
  }

  msg( m, payload ) {
    if (payload) m.payload = payload // ну просто удобное апи

    if (typeof(m.label) !== "string") {
       console.error("rapi::msg label is not string",m.label)
       console.error("btw msg value is",m)
    }

    let listp = this.get_list( m.label )
    return listp.then( list => {
      return list.msg( m, this )
    })
  }

  /////////////////////////////
  generate_uniq_query_id( prefix ) {
    //return `${this.sender}_${prefix}_${this.counter++}_of_${process.pid}_[rand_${Math.floor( Math.random()*10000 )}]`;
    //return `[${this.counter++}rand_${Math.floor( Math.random()*10000 )}]_${this.sender}_${prefix}_of_${process.pid}`;
    return `${this.counter++}_[${prefix}]_${this.sender}_pid_${process.pid}`;
  }

  // выяснилось что и находясь в клиентском процессе мы хотим размещать реакции (а не только квери)
  // чтобы строить граф продолжений
  // кстати мб объединить opts и arg чтобы он там явно фигурировал?

  // наличие deployed_items_resolve позволяет нам узнать, что реакция фактически разместилась
  deployed_items_resolve={}

  // размещает реакцию в системе
  reaction(crit, opts={}, arg={} ) {

    //console.log("ppk.reaction",{code})
    let id = opts.reaction_id || this.generate_uniq_query_id( opts.prefix || "reaction" );
    // в целом нам бы и центр мог бы айди назначать..

    let kvant = { 
       crit: crit,
       name: id,
       cmd: "add_item",
       value: {
         N: opts.N,
         test: opts.test,
         q_priority: opts.q_priority,
         arg: arg, // не используется
         on_delete: opts.on_delete, // F-REACTION-ON-DELETE
         only_saved: opts.only_saved //, // F-FOR-EACH
         //state: opts.state || {}
       }
    }

    let fres = {
      id,
      action: (code,arg={}) => {
        kvant.value.action = (code?.bind ? code.toString() : code)
        if (!kvant.value.action) {
          console.error("reaction action is undefined!",kvant)
          return
        }
        //console.log("action=",kvant.value.action,"arg=",arg)
        kvant.value.arg = arg
        let p = new Promise( (resolve,reject) => {
          this.deployed_items_resolve[ id ] = resolve
          this.send( kvant )
          // теперь ждем ответа -- resolve когда-нибудь вызовут
        })
        p.delete = () => fres.delete()
        return p
      },
      submit: (arg) => { // F-MAIN-SHARED-SETS 
        // мы просто для удобства это здесь разместили. так это к реакциям не относится.
        // размещает не функцию но значение
        // todo убрать это отсюда
        // note фишка что это работа с 1 значением только!
        kvant.value.arg = arg
        let p = new Promise( (resolve,reject) => {
          this.deployed_items_resolve[ id ] = resolve
          return this.send( kvant )
          // теперь ждем ответа -- resolve когда-нибудь вызовут
        })
        p.delete = () => fres.delete()

        return p
      },
      delete: () => { // функция удаления реакции
          //console.log("deactivating reaction call!")
          let d_kvant = { crit, name: id, cmd: "delete_item" }
          this.send( d_kvant )
      }
    }
    return fres
  }

  // shared("list-name").submit(42).delete()
  // shared("list-name").subscribe( callback_on_change )
  // shared("list-name",{id:"my_id"}).submit(42)
  // shared("list-name",{id:"my_id"}).subscribe( callback_on_change )
  // idea: а нельзя ли shared преобразовать в канал?
  // или в пачку каналов - добавленное, удаленное, итоговое
  // там кстати уже вон changed проглядывает - сделать такое же но для наших каналов
  shared( crit, opts={} ) {
    opts.reaction_id ||= opts.id
    let p = this.reaction( crit, opts )

    p.subscribe = (cb) => {
      this.get_list( crit ).then( list => {
        list.changed.subscribe( cb )
        // там канал. а стало быть вызовем и вручную на первый раз.
        cb( list.get_values() )
      })
    }

    return p;
  }

  // новое апи 2024-01
  // создает объект чтения списка
  shared_list_reader( crit ) {

    let p = {}
    // получается эти мы инициируем процесс чтения.
    // ну ридер он на то и ридер. если не надо - пользуйтесь writer-ом.
    let list = this.get_list( crit )

    p.changed  = CL2.create_cell()  // список поменялся
    p.setted    = CL2.create_channel() // значение установлено
    p.added    = CL2.create_channel()  // значение добавлено (а раньше не было)
    p.deleted  = CL2.create_channel()  // значение удалено
    p.loaded  = CL2.create_channel()  // начальные значения

    let unsub = ()=>true
    p.stop = () => unsub() // stop = хватит читать

    list.then( (list_object) => {
/*
      console.error("shared_list_reader creating subscription to deleted. list_object.deleted=",list_object.deleted+'')
      list_object.deleted.subscribe( x => {
        console.error("shared_list_reader: see source list deleted val",x)
      })
*/      

      let b1 = CL2.create_binding( list_object.changed, p.changed )
      let b2 = CL2.create_binding( list_object.setted, p.setted )
      let b3 = CL2.create_binding( list_object.added, p.added )
      let b4 = CL2.create_binding( list_object.deleted, p.deleted )


      unsub = () => {
        b1.destroy()
        b2.destroy()
        b3.destroy()
        b4.destroy()
      }
      let vals = list_object.get_values()
      p.changed.submit( vals )
      p.loaded.submit( vals )
    })

    return p
  }

  // создает объект для записи значения по указанному идентификатору
  // если надо несколько значений, надо создавать разные shared_list_writer
  // idea можно сделать опцию чтобы значение было неудаляемое автоматически как сейчас по завершению связи
  shared_list_writer( crit,opts={} ) {
    opts.reaction_id ||= opts.id
    let p = this.reaction( crit, opts )
    // там получается есть команда submit и delete
    return p
  }

  // F-RUNNERS-LIST
  wait_workers( n ) {
    return new Promise( (res,rej) => {
      this.shared("runners-list").subscribe( l => {
        if (l.length == n) res(l)
        //console.log("see runners-list",l)
      })
    })
  }


  // размещает реакцию в системе
  //add_value(crit, id, arg ) 
/*
    //console.log("ppk.reaction",{code})
    let id = id || this.generate_uniq_query_id( "add_value" );
    // в целом нам бы и центр мог бы айди назначать..

    let kvant = { 
       crit: crit,
       name: id,
       cmd: "add_item",
       value: {
         N: opts.N,
         test: opts.test,
         q_priority: opts.q_priority,
         arg: arg,
         only_saved: opts.only_saved, // F-FOR-EACH
         state: opts.state || {}
       }
    }

    let fres = {
      action: (code,arg={}) => {
        kvant.value.action = (code?.bind ? code.toString() : code)
        kvant.value.arg = arg
        let p = new Promise( (resolve,reject) => {
          this.deployed_items_resolve[ id ] = resolve
          this.send( kvant )
          // теперь ждем ответа -- resolve когда-нибудь вызовут
        })
        p.delete = () => fres.delete()
        return p
      },
      value: (arg) => { // F-MAIN-SHARED-SETS 
        // размещает не функцию но значение
        kvant.value.arg = val
        let p = new Promise( (resolve,reject) => {
          this.deployed_items_resolve[ id ] = resolve
          this.send( kvant )
          // теперь ждем ответа -- resolve когда-нибудь вызовут
        })
        p.delete = () => fres.delete()
        return p
      },
      delete: () => { // функция удаления реакции
          //console.log("deactivating reaction call!")
          let d_kvant = { crit, name: id, cmd: "delete_item" }
          this.send( d_kvant )
      }
    }
    return fres  
  }
*/  

/* вынесен в кустомный клиент, т.к. там сервера или прокси - ему уже решать
  query(crit, opts={}, arg={} ) 
  {
    reaction( crit, opts, arg ).code( msg => {
      // итак мы на клиенте и у нас есть msg
    })
  }*/

  ///// запуск процессов

  // возвращает функцию остановки
  start_process( type, arg, target_worker_id, id) {
    let p = this.shared_list_writer(target_worker_id).submit( {type, arg, id} )
    return p.delete
  }

  ///// тема выполнения заданий

  exec_node( s_expr, opts={} ) {
    let id = this.generate_uniq_query_id( opts.id_prefix || 'exec_node');
    let node = {
       id,
       code: s_expr.code,
       arg: s_expr.arg, // todo надо мержить с opts.arg... наверное..
       //hint: opts.hint,
       //local_env: opts.local_env,
       limits: s_expr.limits || opts.limits,
       exec_node: true,
       coneed: true,
       lang_env: s_expr.lang_env
    }
    return node
  }

  exec_query_for_results = null
  exec_result_label = null
  exec_cb_table = {}

  // todo разбить opts - выделить отдельно args. что такое прям.
  exec(s_expr, opts={})
  {
    ///console.log("subtit exec code=",s_expr.code)
  
    //let id = this.generate_uniq_query_id(opts.id_hint || opts.hint || 'exec'); // было просто exec
    //let id = this.generate_uniq_query_id('exec');
    let promisa = this.create_promise( null, opts.channel_id )

    // задание раннеру конкретному или в общую кучу
    //  F-TASK-SET-RUNNER + F-TASK-SET-RUNNER-DIRECT
    let label = opts.runner_id || 'exec-request-ready'
    //if (typeof(label) )

    let exec_msg = {
       code: s_expr.code,
       arg: {...s_expr.arg, ...this.preprocess_args(opts.arg || {})}, // надо мержить с opts.arg... чтобы были разные контексты задания аргументов
       lang_env: s_expr.opts.lang_env,
       id: promisa.id,
       channel_id: promisa.channel_id, // F-PROMISES-CHANNELS
       ms: 1000000000,
       label,
       hint: opts.hint,
       local_env: opts.local_env,
       client_id: this.client_id, // F-STOP-PROCESSES
       limits: s_expr.limits || opts.limits
    }
    //console.log(exec_msg)

    //opts.cell ||= s_expr.opts.cell
    if (opts.output_cell) 
      exec_msg.output_cell = opts.output_cell // запись пойдет в йачейку    

    // можно было бы добавить поле promise но это дублирование id задачи
    // поэтому мы добавили channel_id. не очень красиво но практично - просто проекция!

    // this.process_args( exec_msg.arg, exec_msg.lang_env )

    let msg_sent = this.msg( exec_msg )

    // F-P-PROMISE
    promisa.hint = opts.hint

/*
    result.stop = () => {
      //this.add( { eval_stop: true, id: id } ); // напрашивается field.patch который работает с краем поля
      //q()
    }
*/
    if (opts.output_cell)
      return opts.output_cell

    return promisa;
  }

  // преобразует аргументы задач - в форму задач
  preprocess_args( arg ) {

    function need( code, id, arg ) {
      return { need: true, code, id, arg }
    }

    let unfat = arg.disable_restore ? false : true;

    //let may_cache = true
    let new_arg = {}

    for (let argname in arg) {
      let value = arg[argname]
      
      if (value) {
        if (value.p_promise) {
           value = need( "read_promise", value.id + "/read-promise", {input: value} )
           if (unfat)
               value = need("restore_object", value.id+":restored", {input: value} )
        } else if (value.cell) {
           value = need( "read_cell", value.id, {input: value, disable_cache:true} )
           if (unfat)
               value = need("restore_object", value.id+":restored", {input: value,disable_cache:true} )
           new_arg.disable_cache = true
        } else if (value.need) 
        { 
           // считается что там уже обработано
           if (value.arg.disable_cache)
              new_arg.disable_cache = true
        }
      }

      new_arg[argname] = value
    }

    return new_arg
    
    /*
      // блок данных с пейлоадами
      // вопрос а зачем этим занимается менеджер? ну или просто удобно было тут..
      // типа чтобы всем клиентам не добавлять?
      if (val.payload_info) {
         //console.log("VAL PAYLOAD. PATCHING",val)
         
         // идентификатор для "ниды" выражающей загрузку данных
         let url_sum = val.payload_info.map( x => x.url )
         let p_id = val.id || `payload:${lang_env}:${url_sum}` // F-KEEP-TASK-ID
         // F-PAYLOAD-BYTES-COUNT
         let bytes_sum = val.payload_info.reduce((a, b) => a.bytes_count + b.bytes_count, {bytes_count:0}) 
         let limits = {ram: bytes_sum}
         // todo тут не совсем get_payload, т.к. в val может быть нечто бОльшее..
         val = {need: true, code: "restore-object", arg: val, id: p_id, limits }
         arg[argname] = val
      } // непосредственно пейлоад
      
      else if (val.url && val.bytes_count) {
        // пейлоада в чистом виде, одна штука..
        let p_id = val.id || `payload:${lang_env}:${val.url}` // F-KEEP-TASK-ID
        let limits = {ram: val.bytes_count}
        val = {need: true, code: "get-payload", arg: {payload_info:val}, id: p_id, limits }
        arg[argname] = val
      }      
      */
    
  }

  /* идея - можно сделать и позиционный define
     в духе f = define( name,s_expr, ["a","b"] ) и вызов f( 10, 20 ) где позиционные замэпяться на указанные имена

     и еще идея - чтобы вместо s_expr подавать js-код и автоматом конвертор rapi.js пусть применяется.
     мы знаем что встроенные конверторы это есть добро 
   */
  define(name,s_expr,opts={})
  { 
    return this.shared("defines").submit( {name, value:s_expr} )

    return


    let limits = opts.limits // limits опция, как в exec

    let promis = this.msg( {
      label: 'set-env',
      id: name,
      value: s_expr
     }
    )

    if (limits) { // F-DEFINE-LIMITS
      this.msg( {
        label: 'set-env',
        id: "limits:" + name,
        value: limits.bind ? limits.toString() : limits
      })
    } else {
      console.error("define: no limits specified",name,opts)
      throw new Error("define: no limits specified")
    }

    // бонус - функция генерации кода
    // idea - тогда уж может быть exec сразу тут..
    let f = ( arg, need_mode ) => {
      //console.log("f is called,",name)
      if (need_mode) {
          return { code: name, arg, need:true }
      }
      return { code: name, arg }
    }
    // todo видимо тут таки промису надо возвращать
    //f.then = 
    return f

/*
    return this.msg( {
      label: 'define-operation',
      type: name,  // заменить на id
      code: s_expr.code,
      arg: s_expr.arg
     }
    )
*/    
    // вопрос. а может это просто set_env? и не важно что там - операция и тп.
    // а потом ток - знай ходи в env (ну типа каждое неизвестное есть ссылка - и имя операции
    // и аргумент и переменная всякая.. так-то было бы удобно)
  }

  // создает s-выражение для выполнения js-кода, пригодное для передачи в exec
  operation_counter = 0 // начальное значение 0 норм, т.к. need_id это строка будет.

  // возвращает s_expr - ниду
  compile_js(code){ 
    let need_id 
    if (!code.need_id) {
      // это мега баг: т.о. разные процессы клиентов начинают использовать одинаковые id      
      // code.need_id = `js-client-api:js:${this.operation_counter++}`      
      // это норм версия:
      code.need_id = this.generate_uniq_query_id('compile-js')
    }
    need_id = code.need_id; // мб из arg брать. которые на самом деле - opts

    let js_code = code.bind ? code.toString() : code

    return { 
          code: "compile_js",
          need: true,
          id: need_id,
          arg: {text: js_code}
        }
  }

  // возвращает s_expr
  // задача - выполнить code
  // но вообще это странный вызов - нерекурсивный. т.к. следующий
  // пример не сработает: rapi.js( F.f_part_call,{f: rapi.js(fn)})
  js(code,arg={}){
    let need_id 
    if (!code.need_id) {
      //code.need_id = `js-client-api:js:${this.operation_counter++}`      
      code.need_id = this.generate_uniq_query_id('call-js')
    }
    need_id = code.need_id; // мб из arg брать. которые на самом деле - opts

    let js_code = code.bind ? code.toString() : code
    let res = { 
      code: "compute", 
      opts: { lang_env: "js" },
      arg: {
        func: { 
          code: "compile_js",
          need: true,
          id: need_id,
          arg: {text: js_code}
        },
        ... this.preprocess_args(arg)
      } // поле arg
    }
    //{ code: "js", arg: arg }
    //res.arg.text = code.bind ? code.toString() : code
    return res
  }

  // создает s-выражение для выполнения указанной операции
  // для задач и для потребностей
  operation(code,arg={}, opts) {
    let res = { code: code, arg: this.preprocess_args(arg), opts }
    //console.log("operation opts",opts)
    return res
  }

  // мб сделать 2 операции а не флаг alloc
  reuse( input,alloc ) {
    let pn = this.operation("reuse_payloads", 
               {
                 input,
                 input_id:input.id, // сохраняем отдельно, т.к. промисы заменяются на значения а нам надо знать айди
                 alloc,
                 disable_restore: true,
                 disable_cache: true
               } )
    pn.id = input.id + "/reuse-payloads"
    pn.need = true
    if (alloc) 
        pn.simple = true // флаг отказа от учета ниды в назначении задач
    // + новое понимание - эти reuse они однократные, так что их всяко не получится учитывать  
    pn.consider = false
    return pn
  }

  skip_payloads( input_promise ) {
    let pn = this.operation("skip_payloads", 
               {input: input_promise, disable_restore: true} )
    pn.id = input_promise.id + "/skip-payloads"
    pn.need = true
    return pn
  }

  // todo
  /*
  keep_promise( input_promise ) {
    let pn = this.operation("keep-promise", {input: input_promise} )
    pn.id = "keep-promise-"+input_promise.id
    pn.need = true
    return pn
  } 
  */ 

}

// need_record: { type: string, arg: { name: identifiable-value, name: identifiable-value }}
// ну вообще то теперь не так. а вот так: .code || .need || .coneed
// но в целом надо подумать. может вообще перейти к подсчету только аргументов.. (но и там могут быть вложенные вещи)
// F-NEED-ID
export function compute_need_id( need_record, cache=false, local_env={} ) {
    if (need_record.id) return need_record.id // кеш..
    //if (need_record.id) return need_record.id // кеш..

    console.error("compute_need_id: id for need/coneed is required!")  
    console.error(need_record)

    throw new Error("compute_need_id: id for need/coneed is required!")

    let parts = [];

    let arg_names_sorted = Object.keys(need_record.arg || {}).sort()
    //  console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>",{need_record})

    for (let key of arg_names_sorted) {
      //console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>> CCID part",key,"->",need_record.arg[ key ])
      parts.push( key )
      if (key == "payload_info") // особый случай
        parts = parts.concat( need_record.arg[ key ].map( p => p.url ) )
      else
        parts.push( compute_value_id(need_record.arg[ key ]) )
    }
    let type = need_record.code; // || need_record.coneed || need_record.need || need_record.type
    let res = type + "[" + parts.join("::") + "]"
    // просто для красоты решил такое айди
    //console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>> res=",parts)

    if (cache)
      need_record.id = res // заменить на need_id?

    return res

    function compute_value_id( value ) {

      let res = compute_value_id_1( value )
      //console.log("compute_value_id ",{value,res})
      if (res?.length > 1024) {
        console.warn("!!!!!!!!!!!!!!!!!!!!!!!!!! compute_value_id(need): id too long!",res.length, {need_record})
        throw new Error("too long id for need")
      }
      
      return res
    }

    function compute_value_id_1( value ) {
      if (typeof(value) == "string") return value
      if (typeof(value.id) !== "undefined") return value.id
      if (value.to_id) return value.to_id()
      //if (value.url) return value.url // вариант для payload_info
      if (Number.isFinite(value)) return value.toString();
      if (typeof(value) == "boolean") return value.toString();

      // это нида или конида
      if (value.code) 
        return compute_need_id( value, cache, local_env )
        else // это ссылка
        if (value.ref) return compute_value_id( local_env[ value.ref ])

      console.error("compute_value_id(need): ********* no way to get id from value",value)
      throw ("compute_value_id(need): ********* no way to get id from value")
    }
  }
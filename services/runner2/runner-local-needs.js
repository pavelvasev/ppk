import {compute_need_id} from "ppk/api-lib.js"

/*
  не только деплой нидов, но и их завершение вынуждены быть промисами.
  тк.. например запуск подпроцесса это ожидание. и завершение - тоже ожидание.
*/

/* todo надо очищать нидсы и по времени или по другим вещам.
   а то их копится тыщи и поиск в них замедляется (и в раннера и у менеджера)
*/

// задача разворачивать и кешировать ниды
export class DeployedNeeds {
  dict = {}; // need_id -> need_value
  // todo Map !!!!!!!

  constructor()
  {    
  }
  // возвращает словарь развернутых нидсов, ключи - глобальные global_id нидсов
  get_keys() {
     return Object.keys(this.dict).reduce( (result,key) => { result[key]=true; return result; },{})
  }

  // развернуть задачи из local_needs и вернуть промису с таблицой развернутых  
  // local_needs это операнды (т.е. набор именованных нидов, имена локальные): {a:need_expr, b:need_expr,...}
  prepare_local_needs( local_needs, needs_info_table, compute_fn ) 
  {
     let n_local_ids = Object.keys( local_needs )
     let nds = n_local_ids.map( n => this.prepare_one_need( local_needs[ n ], needs_info_table, compute_fn ))
     //console.log( "prepare_local_needs, going wait allsettled nds=", nds )
     return Promise.allSettled( nds ).then( arr => {
       console.verbose( "prepare_local_needs done, n_local_ids=", n_local_ids,arr )
       // готовим локальную табличку
       let local_needs = {}
       n_local_ids.forEach( (n,index) => {
         local_needs[n] = arr[index].value
         if (arr[index].reason)
            throw arr[index].reason
       })
       return local_needs
     })
  }

  // взять ниду из кеша или развернуть
  prepare_one_need( need, needs_info_table, compute_fn ) 
  {
     let global_id = compute_need_id( need, true )
     let exist = this.dict[ global_id ]
     if (exist) {
       //this.touch()
       return exist
     }

     console.log("prepare_one_need",{global_id})

     //let h = this.deploy_started( global_id )
     return this.deploy_need( need, needs_info_table, compute_fn, global_id ).then( entry_point => {
       //this.deploy_finished( h )
       console.log("prepare_one_need done",{global_id,entry_point})
       this.dict[ global_id ] = entry_point
       return entry_point
     })
  }
  //deploy_started() {}
  //deploy_finished() {}

  // развернуть ниду (вычислить)
  // need-запись из задачи, needs_table - вся необходимая таблица знаний
  deploy_need( need, needs_info_table, compute_fn )
  {
     console.verbose("deploy_need called. need=",need)

     // todo аккуратно понять то ли это то что надо?
     return compute_fn( need.code, need.arg, needs_info_table ) 

     //let nit = needs_info_table.find( ni => ni.type == need.type )
     let nit = needs_info_table[ need.code ]

     if (!nit) {
       console.error("deploy_need: need is not defined in table: code=",need.code,"need=",need)
     }

     //console.log("deploy_need",{need,needs_info_table,nit})

     let code = nit.code;
     let arg = {...nit.arg}; // аргументы из таблицы

     // копируем аргументы из need-записи задачи
     for (let arg_item in need.arg || {})
       arg[ arg_item ] = need.arg[ arg_item ];

     if (!code) {
      if (nit.fn) {
        return nit.fn( arg ) // странно все это - мы и в раннере fn вызываем и тут.. и там копируем аргументы и тут..
      }
      else
        console.error("deploy_need: code not specified", {need, nit} )
     }

     return compute_fn( code, arg, needs_info_table )
  }

  forget_need( global_id ) {
    let q = this.dict[ global_id ]    
    delete this.dict[ global_id ];
    console.log("forget_need: entering cleanup",q)
    return Promise.resolve( q?.cleanup?.bind ? q.cleanup() : true )
  }

}

// import { memoryUsage } from 'node:process';

// задача чистить нидсы
// F-NEED-COST-VECTOR, F-NEED-COST-SELF
/* сортировать их похоже надо по доступу а не по цене памяти
   а то там засел один процесс и не выползает никогда потому что у него цена чуууть чуть меньше стала )))ы
*/
export class TrackDeployedNeeds {

  resources_used = {} // rsr  -- ресурсы используемые раннером (сумма ресурсов нидсов)
  resources_total = {} // rsr -- ресурсы выданные раннеру для работы
  expanded_needs = new Map() // need -> { информация об использовани, resources:rsr }

  constructor(DN, resources_total) {
    this.DN = DN
    this.resources_total = resources_total

    //DN.deploy_started = (id) => this.deploy_started(id)
    //DN.deploy_finished = (h) => this.deploy_finished(h)
    this.orig_deploy_need = DN.deploy_need.bind(DN)
    DN.deploy_need = this.deploy_need.bind(this)

    this.orig_prepare_one_need = DN.prepare_one_need.bind(DN)
    DN.prepare_one_need = this.prepare_one_need.bind(this)

    this.regen_next_release()
  }

  // F-NEED-LRU делаем
  prepare_one_need( need, needs_info_table, compute_fn ) {    
    let res = this.orig_prepare_one_need(need, needs_info_table, compute_fn)
    Promise.resolve(res).then( () => {
      let global_id = compute_need_id( need, true )
      this.touch( global_id )
    }).catch( () => {
      //console.error("hereman!")
      return true
    } )
    return res
  }

  get_keys() { return this.DN.get_keys() }
  prepare_local_needs( ...args ) {
    return this.DN.prepare_local_needs( ...args )
  } 

  // фактическое вычисление потребности
  deploy_need( need, needs_info_table, compute_fn, global_id ) {
    if (!global_id) // без идентификатора => это не надо сохранять (корневые ниды..)
       return this.orig_deploy_need( need,needs_info_table,compute_fn )
     // хотя быть может окажется что надо. но пока так

  	return new Promise( (resolv,reject) => {
      this.deploy_started( global_id, need, needs_info_table ).then( h => {
    	  let res = this.orig_deploy_need( need,needs_info_table,compute_fn )
        //console.error("EEEE res=",res)
    	  res.then( value => {
          this.deploy_finished( h, value, need ) 
          resolv( value )
        }).catch( err => {
          reject( err )
        })

      })
    })
  }

  touch( global_id, task_id ) {
      let rec = this.expanded_needs.get(global_id)
      if (rec) {
        rec.access_time = performance.now()
        if (task_id)
          rec.touched_by_task = task_id
        return true
      }
      return false
  }

  // защищает ниду от удаления
  lock( global_id, task_id ) {
      let rec = this.expanded_needs.get(global_id)
      if (rec) {
        rec.access_time = performance.now()
        if (task_id)
          rec.touched_by_task = task_id
        rec.lock_counter ||= 0
        rec.lock_counter++
        //console.error("INC LOCK",global_id,rec.lock_counter)
        return true
      }
      return false
  }  

  // снимает защиту
  unlock( global_id ) {
      let rec = this.expanded_needs.get(global_id)
      if (rec) {
        //console.error("DEC LOCK",global_id,rec.lock_counter)
        if (!(rec.lock_counter > 0)) {
          console.error("unlock: rec.lock_counter is strange!",rec)
        }
        rec.lock_counter ||= 0
        rec.lock_counter--
        
        return true
      }
      return false    
  }

  // ха а как это учтет если limits у задачи указано? (у exec)
  // так что сюда уже видимо надо конечные limits присылать

  // проводит проверку и расчистку свободных ресурсов, чтобы хватило вместить task_limits ресурсов
  // возвращает промису
  // todo qqq
  check_resources( global_id, task_limits={} ) {

    // return Promise.resolve(true)
    
    if (global_id && this.expanded_needs.get(global_id)) return // это у нас есть, чистить не надо

    // ну мы считаем что ресурсы total не меняются тут; можно и учесть будет

    // итак limits это то что надо чтобы было доступно

    let rsr_used = this.get_usage() // текущее потребление
    //console.log("TrackDeployedNeeds. limitы=",limits,"used=",rsr_used)
    console.verbose("check_resources",{global_id,task_limits,rsr_used,total:this.resources_total})
    
    let acc = []
    for (let name in rsr_used) {
      if (task_limits[name]) { // этот ресурс важен задаче
        let resource_limit = (this.resources_total[name] || 0) - (task_limits[name] || 0)
        // rdiff - столько у раннера осталось свободного
        console.verbose("checking",name,"max allowed for existing:",resource_limit,"used by existing:",rsr_used[name])
        acc.push( this.free_by_key( name, resource_limit, rsr_used[name] ) )
      }
    }
    //this.update_usage()
    if (global_id)
    return Promise.all( acc ).catch( failed_resource => {
      return this.next_needa_release.then( () => {
        // todo все сюда придут.. 
        return check_resources( global_id, task_limits )
      })
    })
  }

  // прекрасное место
  deploy_started( global_id, need,needs_info_table  ) {
    // подготовим место
    let limits_rec = needs_info_table[ "limits:" + need.code ]
    if (typeof(limits_rec) === "string") limits_rec = eval( limits_rec )
    else if (limits_rec == null) {
      console.warn("limits_rec not specified!",need)
      limits_rec = {}
    }

    let item_limits = limits_rec.bind ? limits_rec(need.arg) : limits_rec
    return this.check_resources( global_id,item_limits ).then( () => {
      // даже пока процесс ниды не запущен, нам уже надо его ввести в подсчет
      // потому что следом пойдут другие ниды и надо им чистить кеш
      // посему введем какую-то запись, хоть какую
      this.expanded_needs.set( global_id, { pending_finish: true, resources:item_limits } )
      //this.need_recompute_usage()
      this.add_resources( item_limits )

      let h = { id: global_id, t_start: performance.now(), predeclared_limits: item_limits }
      return h
    })
  }
  deploy_finished( h,value, need ) {
    h.t_finish = performance.now()
    h.t_delta = h.t_finish - h.t_start
    if (h.t_delta <= 0) h.t_delta = 0.01

    let result = { id: h.id, info: h, cost: {}, resources: {} }

    let r_fn = value?.resources_usage || ( () => h.predeclared_limits )
    let update_cost = () => {
      // оказалось память процесса не быстро считать поэтому промиса
      Promise.resolve( r_fn() ).then( rsr => {
        let cost = {}
        for (let n in rsr)
          cost[n] = rsr[n] / h.t_delta;  
        result.cost = cost
        result.resources = rsr
      })
    }
    result.update_cost = update_cost
    result.update_cost()
    result.hint = need.hint
    //console.log("USEDHINT from need=",need)

    // cost это некая мера затрат и ценности. чем выше - тем бесполезнее    
    this.expanded_needs.set(  h.id, result )
    // this.need_recompute_usage()
    // мы там аллоцировали а теперь получше посчитали. так что пересчитаем.
    if (value?.resources_usage) {
      this.substract_resources( h.predeclared_limits )
      this.add_resources( result.resources )
    }
    //return h
  }

  // идея в том чтобы посылать на менеджер только изменения
  // заведем 2 списка
  event_new_needs = new Set()
  event_removed_needs = new Set()

  extract_events() {
    let a = [...this.event_new_needs.keys()]
    let b = [...this.event_removed_needs.keys()]
    this.event_new_needs.clear()
    this.event_removed_needs.clear()
    return [a,b, this.expanded_needs]
  }

  // todo resources..
  save_expanded_need( need_id, resources={ram:1024},cleanup=()=>{}, cell ) {
    // хак-проверка --- ну, стало получше
    //if (need_id.startsWith("reuse-payloads-"))
    //  return

    let existing = this.expanded_needs.get( need_id )
    // надо сохранять текущий счетчик т.к. save_expanded_need вызывается многократно - обновляют ресурсы и т.п.
    let record = {
      id: need_id,
      resources,
      cleanup,
      cell: (existing?.cell || cell),
      access_time: performance.now(),
      lock_counter: (existing?.lock_counter || 0)
    }
    //console.error("SET save_expanded_need",need_id)
    //console.trace()
    this.expanded_needs.set( need_id, record )
    //this.need_recompute_usage()
    this.add_resources( resources )
    this.event_new_needs.add( need_id ) // = true // вроде как не надо им там всю record

    return record;
  }

  forget_need( global_id, use_cleanup=true ) {
    this.event_removed_needs.add( global_id )
    //this.need_recompute_usage()        

    let item = this.expanded_needs.get( global_id )

    this.substract_resources( item.resources )

    this.expanded_needs.delete( global_id )

    //console.log("need forgotten",item,"item?.cleanup?.bind=",item?.cleanup?.bind)
    // console.error("forget_need, id=",global_id,"usecleanup=",use_cleanup)

    let res = Promise.resolve( use_cleanup && item?.cleanup?.bind ? item.cleanup() : true )

    //let res =  this.DN.forget_need( global_id )
    res.then( () => {
      this.next_needa_release.resolve() // это у нас механизм проталивания блокировки check_resources
      this.regen_next_release()
    })
    return res
  }

  regen_next_release() {
    let a,b
    let p = new Promise( (resolve,reject) => {
      a=resolve
    })
    p.resolve = a
    this.next_needa_release = p      
  }

  forget_all_needs() {    
    for (let k in this.DN.dict) {
      this.forget_need( k )
      // delete this.expanded_needs[ global_id ]
    }
    console.log("forget all needs done. this.expanded_needs=",this.expanded_needs)
  }
  // проводит проверку диапазонов лимитов процесса раннера
  // и удаляет из него самые невыгодные нидсы
  tick2() {

    // todo стирать наверное те что давно не используются? например цену им повышать..
    // т.е. посл использвоание как фактор функции цены

    // вызывают чтобы очистить память.
    let rsr_used = this.get_usage()
    console.log("TrackDeployedNeeds. limitы=",limits,"used=",rsr_used)
    
    for (let name in rsr_used) {
      this.free_by_key( name, limits, rsr_used )
    }

    //console.log("after remove needs=",sorted)
  }

  resources_used = {}

  get_usage() {
    return this.resources_used
  }

  // F-RESOURCES-ADDITIVE
  add_resources( resources ) {
    let acc = this.resources_used

    for (let name in resources)
    {
      acc[name] ||= 0
      acc[name] += resources[name]
    }
  }
  substract_resources( resources ) {
    let acc = this.resources_used

    for (let name in resources)
    {
      acc[name] ||= 0
      acc[name] -= resources[name]
    }
  }  


  // очистить ресурсы по лимиту по ключу
  // key - тип ресурса
  // limit:значение_ресурса - мы должны вписаться в это ограничение
  // used:значение_ресурса - текущее потребление
  // 
  free_by_key(key,limit,used) {
  //console.log( this.resources_used )
    if (used < limit) return Promise.resolve(true)

    //let sorted = Object.values( this.resources_used ).sort( (a,b) => b.cost[key] - a.cost[key] )
    // F-NEED-LRU
    // todo optimize! ... это дорого. и вообще мысль такая - можно без сортировки попробовать а чисто порядком вставки обойтись (но надо делать delete в момент touch)
    let sorted = [...this.expanded_needs.values()] 
      .filter( a => !(a.lock_counter > 0))
      .sort( (a,b) => a.access_time - b.access_time )
    //console.log("tick must remove things. sorted=",sorted.length)
    //console.log("tick must remove things. sorted=",sorted)

    let i = 0
    let acc = [] 
    while (sorted.length > 0 && used > limit) {
      let item = sorted[0]
      console.log('removing',item)
      acc.push( this.forget_need( item.id ) )
      used -= (item.resources[key] || 0)
      sorted = sorted.slice(1)

      this.substract_resources( item.resources )
    }

    if (used < limit) {
      // окей
      console.log("needs cleanup success. used=",used,"limit=",limit)
      //this.need_recompute_usage()
      return Promise.all( acc )
    } else {
      // все занято
      return Promise.reject(key)
    }
  }
}
/*
class Collection {

  constructor( rapi, id ) {
  	this.rapi = rapi
  	this.id = id  	
  }

  add( value )

}  	

class Graph {

  constructor( rapi, id ) {
  	this.rapi = rapi
  	this.id = id
  	this.nodes = new Collection( rapi, id+":processes")
  	this.links = new Collection( rapi, id+":links")
  }

  read_processes() {
  }

  read_links() {
  }
}  
*/

/*
  идея. Сделать не Graph а что-то типа GraphWriter/GraphAccess.
  который имеет метод cleanup который удаляет все созданное.
  что удобно для создания процессов! обеспечения функции их удаления.
*/

export class Graph {

  constructor( rapi, id ) {
  	this.rapi = rapi
  	this.id = id
  	this.writer = this.rapi.shared_list_writer(this.id)

  	this.cleanup_arr = []
  }

  create_process_with_id( id, p_class, ...args_list ) {
  	id ||= this.rapi.generate_uniq_query_id(p_class)
    let s = this.writer.submit( {p_class, args_list, id} )
    this.cleanup_arr.push( s.delete )
    let p = {
    	port: (port_id) => `${id}/${port_id}`,
    	delete: s.delete
    }
    return p
  }

  create_process( p_class, ...args_list ) {
  	//console.log("graph: create_process",{p_class,args_list:JSON.stringify(args_list)})
  	return this.create_process_with_id( null, p_class, ...args_list )
  }

  js_pack( fn ) {
  	return fn.toString()
  }

  create_link( src, tgt ) {
  	return this.create_process( "link_process", src,tgt )
  }

  // ну например такое апи
  read_processes(created,deleted) {
	let procs = this.rapi.shared_list_reader(this.id)
	//return procs
	let u1 = procs.added.subscribe( created )
	let u2 = procs.deleted.subscribe( deleted )
	let unsub = () => { u1(); u2(); }
	this.cleanup_arr.push( unsub )
	return unsub
  }

  delete() {
  	this.cleanup_arr.map( x => x() )
  	this.cleanup_arr = []
  }

  // нам надо преобразовать граф в процесс в терминах того что ожидает process-engine
  make_process(ports={}) {
  	let p =ports
  	p.delete = this.delete.bind(this)
  	return p
  }

}

export function open_graph( rapi, id ) {
	return new Graph( rapi, id )
}

export class GraphApi {
  // все параметры сделаны в опциях чтобы их проще было подать из настроек из внешнего файла и тп
  constructor( rapi ) {
  	this.rapi = rapi
  }

  open_graph( id ) {
  	return new Graph( this.rapi, id )
  }
}

export function shared_def_reader( rapi ) {
  let r = rapi.shared_dict_reader("defines")

  let f = (classname) => {
  	return r.open( classname, true )
  }

  return f
}


// кстати можно будет в rapi забиднить.. по аналогии с другими методами..
// те.. open_graph()

// опирается на defines. в которой функции имеют сигнатуру 
export function setup_process_engine( rapi, graph_id, process_types_fn, worker_ids ) 
{
	graph_id ||= "pr_list"
	process_types_fn ||= shared_def_reader( rapi )

	// туду вытащить это. это вообще отдельное и 1 раз. на всех.
	rapi.define( "link_process", link_process )
  //rapi.shared_list_writer

  // rapi.shared("abilities").submit({title:"График 1",msg:{label:"start_process",type:"gr1",target:"abils"}})

  /// msg api

  let stop_process_fn = {}
  let id_counter = 0

  // todo вынести это в отдельную функцию
  rapi.query("start_process").done( val => {
    console.log("see msg for start_process! val=",val)
    let id = val.id || val.type + "_"+(id_counter++)
    let delete_fn = rapi.start_process( val.target || graph_id, id, val.type, val.arg )
    stop_process_fn[ id ] = delete_fn
  })

  // todo надо обобщить. т.е. управлять прямо списком бы..
  rapi.query("stop_process").done( val => {
    console.log("see msg for stop_process! val=",val)
    let f1 = stop_process_fn[ val.id ]
    if (f1) { f1(); return }
    // F-EXTERNAL-REMOVE
    // ок размещали не мы
    procs.list.then( (list_object) => {
      //console.log("RRR=",list_object.records)
      for (let n of list_object.records.keys()) {        
        let rec = list_object.records.get(n)
        console.log(rec.arg.id,val.id)
        if (rec.arg.id == val.id) {
          // наш клиент
          //console.log("TGT=",n)
          rapi.shared_list_writer( graph_id,{id:n}).delete()
          break;
        }
      }
    })
    //let active_procs = procs.changed.get()
    //console.log({active_procs})
  })

  //////////////////////// list api
  let stop_process_fn2 = {}

  let procs = rapi.shared_list_reader(graph_id)

  function start_process( record ) {
    //console.log("see process request",val)
    let {p_class,id,args_list} = record 
    //console.log("pr_list: see process request",{p_class,id,args_list})

    id ||= p_class + "_p_"+(id_counter++)

    process_types_fn( p_class ).then( fn => {    	

        if (!fn) {
	      console.error("process start function is null for p_class",{p_class,fn})
	      return
	    }

	    console.log("calling",{p_class,fn})

	    let r = fn( rapi, id, ...args_list )

	    if (!r) {
	      console.error("null result from object of p_class ",p_class,"r=",r)
	      r = {}
	    }

	    if (!r.delete) {
	      console.error("no delete record for created object of p_class ",p_class)
	      r.delete = () => {}
	    }

	    // публикуем порты созданного процесса
	    let stop_publish_ports = publish_ports( rapi, id, r )

	    stop_process_fn2[ id ] = () => {
	      //console.log('stop_process_fn2',id)
	      r.delete(); 
	      stop_publish_ports(); 
	      delete stop_process_fn2[ id ] 
	    }

    })
  }

  // начальные значения F-SPAWN-ON-START
  /*
  procs.loaded.once( initial_values => {
    console.log("pr_list loaded:",initial_values)
    for (let val of initial_values)
      start_process( val )
  })
  */

  procs.added.subscribe( val => {
    start_process( val.value.arg ) // чето перебор
  })

  procs.deleted.subscribe( val => {
    console.log("pr_list procs: see procs deleted from list",val)
    let process_id = val.value.arg.id // фантастика
    //console.log("process_id=",process_id)
    // и как мы тебя удалять будем?
    // по идее контейнер
    let fn = stop_process_fn2[ process_id ]
    if (fn) fn(); else console.error("delete: process not found")
  })

}

function publish_ports( rapi, id, ports_record ) {
  let stop_arr = []

  for (let k in ports_record) {
    let r = ports_record[k]
    if (Array.isArray(r)) {
      //console.log("found port:",id+"/"+k,r)
      // id: id-процесса / порт
      // channels: перечень каналов 
      let unsub = rapi.shared_list_writer("ports").submit({id:id+"/"+k,channels:r})
      stop_arr.push( unsub.delete )      
    }
  }

  return () => {
    stop_arr.map( (x,index) => {
      //console.log("stop_fn calling x",x, index)
      x()
    } )
  }
}



let link_process = ( rapi, id, src_port_id, tgt_port_id ) =>
{
  //console.log("link_process arg=",arg)
  function mkid(part_id) { return id + "/"+part_id }


	// allow_loop - если порты по мощности не совпадают, создать циклическую связь
	function create_link( rapi, src_port, tgt_port, allow_loop ) {

	  if (!src_port) {
	    console.error("PortLink: src_port is null! tgt_port=",tgt_port)
	    console.trace();
	  }

	  if (!tgt_port) {
	    console.error("PortLink: tgt_port is null! src_port=",src_port)
	    console.trace();
	  }

	  let link
	  if (src_port.length == tgt_port.length) {
	    link = src_port.map( (x,index) => rapi.create_link( x.id, tgt_port[index].id))    
	  } else if (allow_loop) {
	    if (src_port.length == 1) {
	      link = tgt_port.map( (x,index) => rapi.create_link( src_port[0].id, tgt_port[index].id))
	    } else console.error("create_port_link: not implemented case1")

	  } else console.error("create_port_link: ports links count mismatch")

	  link.destroy = () => {
	    //console.log("destroy port link")
	    for (let x of link) x.unsub()
	  }

	  return link
	}  

  let link

  // todo переделать на shared_dict_reader
  let ports = rapi.shared_list_reader("ports")

  let u = ports.changed.subscribe( val => {    
    let src_port_info = val.find( x => x.id == src_port_id )
    let tgt_port_info = val.find( x => x.id == tgt_port_id )    
    if (src_port_info && tgt_port_info) {
      console.log("link_process: creating real link for ",{src_port_id, tgt_port_id})
      //link = LINK.create( rapi, src_port_info.channels, tgt_port_info.channels, true )
      link = create_link( rapi, src_port_info.channels, tgt_port_info.channels, true )
      u(); u = () => {}
      // больше нас не вызывают, ссылка создана
    }
  })

  return {delete: () => {
    u()
    if (link) link.destroy()
  }}
}

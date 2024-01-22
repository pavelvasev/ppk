// КАНАЛЫ (ячейки)
// канал-ячейка отличается от записи просто в метку сообщения тем,
// что есть буфер на запись (с повтором вновь подключающихся)
// и есть буфера на чтение (с указанным кол-вом записей)

// и СВЯЗЬ между ними.

// в целом идея каналов (ячеек, портов) и связей между ними - 
// пришла из Clon, Lingua Franca, и XCluDev Дениса Перевалова. 
// А точнее - идея + реалиазация, хоть я все и по своему интерпретирую.

// idea сделать rapi.to_local_promise универсальное
// для промис и для ячеек. причем для ячейки это вызов next() подразумевает

// idea reading-cell может заказывать, какие поля ей нужны. чтобы все не гонять.
   // начнется некое сходство с потоками adios, где мне кажется тоже не все посылается
// idea если сообщения однородны, их схему можно послать 1 раз.

export default function init( rapi) {
  return new Cells( rapi )
}

export class Cells {

  constructor( rapi) {
 	  this.rapi = rapi
  }

  create_cell(id) {
    if (id.id && id.cell) id = id.id // встроенный адаптер
    if (!(typeof(id) === "string")) {
      console.error("create_cell: error! passed cell id must be string or cell. you passed:",typeof(id),"value=",id)
      return null
    }
  	return new WritingCell( this.rapi, id )
  }

  read_cell(id, opts={}) {
    if (id.id && id.cell) id = id.id // встроенный адаптер
    if (!(typeof(id) === "string")) {
      console.error("create_cell: error! passed cell id must be string or cell. you passed:",typeof(id),"value=",id)
      return null
    }
  	return new ReadingCell( this.rapi, id, opts.limit, opts.overwrite )
  }

  open_cell( id ) {
    if (id.id && id.cell) id = id.id // встроенный адаптер
    return { cell: true, id }
  }

  create_link( src_id, tgt_id ) {
    if (src_id == null || tgt_id == null) {
       console.error("create_link bad args!",{src_id, tgt_id} )
       return
    }
    return new Link( this.rapi, src_id, tgt_id )
  }

}  

function cell_label( id ) {
  if (id.id && id.cell) id = id.id
  return `${id}(cell)`
}

// связь двух ячеек. можно было еще binding назвать.
export class Link {
  constructor( rapi, src_id,tgt_id) {
    this.rapi = rapi
    this.src_id = src_id
    this.tgt_id = tgt_id
    //console.log("HI FROM LINK", {src_id,tgt_id})

    let f = ( msg, r_arg, local_rapi ) => {
      //console.log("RRRR args 1=",msg,"2=",r_arg)
      //console.error("RRRR args 1=",msg,"2=",r_arg)
      //console.trace()
      r_arg.output_cell ||= local_rapi.create_cell( r_arg.tgt_id )
      if (local_rapi.verbose)
         console.log("link: submitting to target channel ",r_arg.tgt_id,"msg=",msg)
      r_arg.output_cell.submit( msg.value )
      //local_rapi.msg( msg )
    }

    let stop_f = ( r_arg ) => {
      //console.log("stop-f function called. r_arg = ",r_arg)
      if (r_arg.output_cell) { // F-REACTION-ON-DELETE
        console.log("stop-f function removed output cell",r_arg.output_cell.id)
        r_arg.output_cell.stop()
        r_arg.output_cell = null
      }      
    }

    //console.log("link: deploy-ing reaction to:",cell_label(src_id),"with tgt",tgt_id)

    // tgt_id здесь не надо преобразовывать, его create_cell обрабтает в реакции
    this.unsub = rapi.reaction( cell_label(src_id), {on_delete: stop_f.toString() } ).action( f, {tgt_id} ).delete
  }
}

// процесс записи в ячейку
export class WritingCell {
  constructor( rapi, id) {
  this.cell = true // надо для preprocess_args / exec
 	this.rapi = rapi
 	this.id = id
 	this.is_set = false
 	this.label = cell_label(this.id)
 	this.list = rapi.get_list( this.label )
 	this.list.then( list => {
 		this.setted_unsub = list.setted.subscribe( (rec) => {
      // произошло добавление/установка в список нового слушателя
 			console.log("writing_cell: submit to newcomer!",rec, "value=",this.value,"id=",this.id)
 			if (this.is_set)
 				rec.value.action( {label:this.label, value:this.value}, rec.value.arg, rapi )
 		})
 	})
  }
  submit( value ) {
  	this.is_set = true
  	this.value = value
    //console.log("submitting to cell",{label:this.label, value})
    if (console.verbose)
        console.verbose("submitting to cell",{label:this.label, value})
  	return this.rapi.msg( {label:this.label, value})
  }
  to_record() {
    return { cell: true, id: this.id }
  }

  toJSON() {
    return { cell: true, id: this.id }
  }

  close() { // прекратить вещание
    if (this.setted_unsub)
        this.setted_unsub() // перестать узнавать о новых подключениях
    this.setted_unsub = null
    // нелья, вдруг там другие слушатели
    //this.rapi.forget_list( this.label )
    this.list = null
    this.submit = (val) => {
      console.error("sumbitting to closed writing cell!",val)
    }
  }
  stop() {
    this.close()
  }
}

// процесс чтения ячейки
export class ReadingCell {

  toJSON() {
    return { cell: true, id: this.id }
  }

  toString() {
    return `reading_cell[id=${this.id}]`
  }

  to_record() {
    return { cell: true, id: this.id }
  }

  stop() {
    // убираем запрос - нам больше не интересно получать сообщения
    this.query.delete()

    // и отменяем все ожидания которые висят текущие
    this.pending_promises.map( x => x.reject() )

    // ну и поможем сборщику мусора, хотя он по идее сам справится
    this.unvisited_values = [] 
  }

  constructor( rapi, id, queue_limit) {
    this.cell = true // надо для preprocess_args / exec
 	this.rapi = rapi
 	this.id = id
 	this.label = cell_label(this.id)
 	this.query = this.rapi.query( this.label )
 	// todo добавить деструктор отписку this.query.delete()
  //console.log("installed reading cell query:",this.label)

 	this.unvisited_values = []
 	this.pending_promises = []
  //this.queue_limit = queue_limit
  //this.overwrite = overwrite

 	this.query.done( (msg) => {
 		if (this.pending_promises.length > 0) {
 			let p = this.pending_promises.shift(); // todo optimize pop?
 			p.resolve( msg.value )
 		} else {
      if (queue_limit) {
        // удаляем ячейки пока не будет места
        while (this.unvisited_values.length > queue_limit-1) 
          this.unvisited_values.shift()
      }
      else  // безлимитный режим
 			  this.unvisited_values.push( msg.value )
 		}
 	})
  }

  // цель выдать промису на значение
  next() {
  	let p = this.create_promise()
  	if (this.unvisited_values.length > 0) {
  		let v = this.unvisited_values.shift()
  		p.resolve(v)
  	} else {
  		this.pending_promises.push( p )
  	}
  	return p;
  }

  // создает локальную промису
  create_promise() {
      // будем использвать js промисы внутри, так удобно
      let p_resolve, p_reject
      let p = new Promise( (resolve, reject) => {
        p_resolve = resolve
        p_reject = reject
      })
      //p.p_promise = true      
      p.resolve = (value) => {
         //console.log("ReadingCell CELL RESOLVED",this.label, value)
            p.resolved = true
            return p_resolve(value)
        }
      p.reject = (err) => {
        p.rejected = true
        //console.log("rejecting promise",p.id || "")
        p.catch( () => {
          //console.error("inside default promise catch.")
        }) // надо хотя бы 1 раз поймать а то unhandled rejection
        // потому что формально эту промису могут и не ловить
        // но вроде как ничего страшного если мы ее отменили - в целях остановки канала
        // но с другой стороны если там then был.. то он сам должен обеспечивать
        // отлов остановки канала
        return p_reject(err)
      }

      return p
  }

}
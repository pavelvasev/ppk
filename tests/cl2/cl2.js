#!/bin/env node

class Channel {
	// провести сигнал
	emit( value ) {
		//console.log(this.subscribers)
		this.subscribers.forEach( fn => fn(value) )
		//this.is_cell = true
	}
	subscribers = new Set()
	// подписаться к этому каналу. 
	on( cb ) {
		this.subscribers.add( cb )
		let unsub = () => {
			this.subscribers.remove( cb )
		}
		return unsub
	}
	subscribe( cb ) { // синоним
		return on( cb )
	}
	// подписать этот канал на другой канал
	// если были подписки на другие каналы они сохраняются.
	connect_to( source_channel ) {
		let unsub = source_channel.on( (val) => this.emit(val) )
		return unsub
	}

	// связывание с другими примитивами синхронизации
	bind( source_object ) {
		if (source_object instanceof Channel)
			return this.connect_to( source_object )
		// дают ячейку?
		// ну будем слушать для интереса assigned. а если мало - уточняйте что слушать
		// надо ли установить начальное значение?
		// кстати вообще идея.. если есть set и есть get то сделать всегда set( get() )
		// и может быть - метода get это его значение.. хотя это дорого
		if (source_object instanceof Cell) 
			return this.connect_to( source_object.assigned ) 
		// нам дают на вход метод - значит мы слушаем его результаты
		if (source_object instanceof Method)
			return this.connect_to( source_object.result )		
		throw new Error(`Channel: do not know how to bind source_object=${source_object}`)
	}
}

function create_channel() {
	let channel = new Channel()
	return channel
}

class Method { // Code?
	constructor( fn ) {
		this.call = create_channel()
		this.result = create_channel()
		this.call.on( (arg) => this.result.emit( this.eval(arg) ) )
		if (fn) this.set(fn)
	}

	set( code ) {
		this.code = code
	}
	eval( ...args ) {
		return this.code.apply( this, args )
	}

	// связывание с другими примитивами синхронизации
	bind( source_object ) {
		// дают на вход канал - значит мы слушаем канал и вызываем метод
		//console.log("method connected to input from",source_object)
		if (source_object instanceof Channel)
			return this.call.connect_to( source_object )
		if (source_object instanceof Cell)
			return this.call.connect_to( source_object.changed )
		throw new Error(`Channel: do not know how to bind source_object=${source_object}`)
	}
}

function create_method(x) {
	let k = new Method(x)
	return k
}


class Cell {
	value = null
	constructor( initial_value ) {
		this.changed = create_channel()
		this.assigned = create_channel()
		this.assigned.on( (value) => this.set(value))
		this.set( initial_value )
	}
	/* вопрос.. метод set как соотносится с каналом assigned?
	   т.е запись в канал вызывает set
	   или вызов set вызывает уведомление канала, что что-то было?

	   update можно сделать assign и то будет запись в assigned
	*/
	set( new_value ) {
		if (new_value != this.value) {
			let old_value = this.value
			this.value = new_value
			this.changed.emit( new_value, old_value )
			// вот тут вопрос - а что если ну общее значение emit это кортеж
			// но он же всегда пусть и передается во все on да и все?
		}
	}
	get() {
		return this.value
	}
	// связывание с другими примитивами синхронизации
	bind( source_object ) {
		// дают на вход канал - значит мы слушаем канал и вызываем метод
		//console.log("cell connecting to input from",source_object,"source_object instanceof Method=",source_object instanceof Method)
		if (source_object instanceof Channel)
			return this.assigned.connect_to( source_object )
		if (source_object instanceof Cell) {
			let res = this.assigned.connect_to( source_object )
			this.set( source_object.get() ) // а если там ничего нет?
			return res
		}
		if (source_object instanceof Method) {
			return this.assigned.connect_to( source_object.result )
			// надо ли его вызывать?
			//this.set( source_object.get() ) // а если там ничего нет?
		}
		if (source_object instanceof Function) {
		}
		throw new Error(`Cell: do not know how to bind source_object=${source_object} type=${typeof(source_object)}`)
	}	
}

function create_cell() {
	let k = new Cell()
	return k
}

class Object {
}

// embed_list массив вида имя, объект, имя, объект..
function create_object( embed_list ) {
	let k = new Object()
	return k
}

class Item {
	constructor(parent, children=[]) {		
		this.parent = create_cell(parent)
		this.parent.changed.subscribe( (val) => {
			// изменили parent
			if (val)
				val.append( this )
		})
		this.children = create_cell(new Set())
		this.appended = create_channel()
		this.removed = create_channel()

		for (let k of children)
			this.append( k )
	}
	append( child ) {
		this.children.get().add( child )
		if (child.parent.get() != this)
			child.parent.set( this )
		this.children.changed.emit( this.children.get() )
		this.appended.emit( child )
	}
	remove( child ) {
		this.children.get().remove( child )
		child.parent.set( null )
		this.children.changed.emit( this.children.get() )
		this.removed.emit( child )
	}
}

function create_item(parent,children=[]) {
	let k = new Item(parent,children)
	return k
}

// а вообще это надо если мы просто через a.b = ... работаем?
// но чилдрены опять же анонимны.. точнее они другое отношение..
function embed( target_object, name, embedded_object )
{
	if (target_object.hasOwnProperty(name))
		throw new Error(`target_object already has element name = '${name}'`)
	target_object[name] = embedded_object
}

class Binding {
	constructor( src,tgt ) {
		this.unsub = tgt.bind( src )
	}
}

function create_binding( src, tgt ) {
	let k = new Binding( src,tgt )
	return k
}

let a = create_channel()
let b = create_channel()

b.connect_to( a )
b.on( x => console.log("b pass",x) )
a.emit(33)
a.emit(47)

let c = create_method( (x) => x*x )

// ну и вопрос. у нас тут что, method connect to? но вообще это странно.
//но в целом метод может иметь свою ячейку канала вызова. о. пусть
//он имеет канал вызова
//c.call.connect_to(b)
create_binding( b, c )

// но вообще тогда напрашивается и канал результатов. ну а почему нет
c.result.on( console.log )
a.emit(10)

// ну вот. это довольно интересно. тут у нас и метод. и канал вызова его.
// и канал результатов даже имеется/
// и более того, мы этот метод привязывать сможем..
// ну вот завтра попривязываем. а так уже мило.

/// задача создать штуку считающую площать.
/*
let computer = create_object( 
	"w",create_cell(),
	"h",create_cell(),
	"area",create_cell(),
	"output",create_cell(),
	"compute",create_method( (a,b) => a*b ), /// ???
	create_binding( ... )
)
*/

// мб create_method( .. ).bind( )
// ну а может быть просто не так сразу.. а пока хотя бы как-нибудь
// ну т.е. нам нужна функция которая создаст интересующий объект.

// надо аргументы?
function create_area_computer() {
	let obj = create_object()
	obj.w = create_cell() // или таки embed?
	obj.h = create_cell()
	obj.output = create_cell()
	obj.compute = create_method( () => obj.w.get()*obj.h.get() )	
	//obj.compute = create_method( (a,b) => a*b )	
	create_binding( obj.compute, obj.output )
	create_binding( obj.w, obj.compute )
	create_binding( obj.h, obj.compute )
	//reaction( obj.w.changed, obj.h.changed, obj.compute.call )
	return obj
}
// по сути эта reaction это групповой биндинг. надо в это воткнуть щас.

let comp = create_area_computer()
//comp.output.bind( console.log ) // ну вот это красивое
comp.output.changed.on( console.log )
console.log("changing w")
comp.w.set( 10 )
console.log("changing h")
comp.h.set( 20 )
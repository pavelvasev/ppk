#!/bin/env node

class Channel {
	// провести сигнал
	emit( value ) {
		//console.log(this.subscribers)
		this.subscribers.forEach( fn => fn(value) )
	}
	subscribers = new Set()
	// подписаться
	on( cb ) {
		this.subscribers.add( cb )
		let unsub = () => {
			this.subscribers.remove( cb )
		}
		return unsub
	}
	connect_to( source_channel ) {
		let unsub = source_channel.on( (val) => this.emit(val) )
		return unsub
	}
}

function create_channel() {
	let channel = new Channel()
	return channel
}

class Cell {
}

function create_cell() {
	let k = new Cell()
	return k
}

class Object {
}

function create_object() {
	let k = new Object()
	return k
}

class Method { // Code?
	constructor() {
		this.call = create_channel()
		this.result = create_channel()
		this.call.on( (arg) => this.result.emit( this.eval(arg) ) )
	}

	set( code ) {
		this.code = code
	}
	eval( ...args ) {
		return this.code.apply( this, args )
	}
}

function create_method() {
	let k = new Method()
	return k
}

function bind( target_object, name, bounded_object ) {

}

let a = create_channel()
let b = create_channel()

b.connect_to( a )
b.on( x => console.log("b pass",x) )
a.emit(33)
a.emit(47)

let c = create_method()
c.set( (x) => x*x )

// ну и вопрос. у нас тут что, method connect to? но вообще это странно.
//но в целом метод может иметь свою ячейку канала вызова. о. пусть
//он имеет канал вызова
c.call.connect_to(b)

// но вообще тогда напрашивается и канал результатов. ну а почему нет
c.result.on( console.log )
a.emit(10)

// ну вот. это довольно интересно. тут у нас и метод. и канал вызова его.
// и канал результатов даже имеется/
// и более того, мы этот метод привязывать сможем..
// ну вот завтра попривязываем. а так уже мило.
// словарь crit -> список реакций
// где список реакций это словарь guid-реакции -> описание реакции
export class ListManager {
	lists = {}
	constructor() {
	}
	get( crit ) {
		let existing = this.lists[crit]
		if (existing) return existing
		let list = new List()
		this.lists[crit] = list
		list.crit = crit
		return list
	}
}

// список реакций -- это словарь guid-реакции -> описание реакции
export class List {
	records = new Map()
	constructor() {
	}
	set(name,value) {
		this.records.set( name,value )
		this.call_listeners('set',{name,value})
		//this.emit('set',{name,value})
	}
	delete(name) {
		//console.log('main list delete',name)
		this.records.delete(name)
		this.call_listeners('delete',{name})
	}
	entries() {
		return [...this.records.entries()]
	}

	listeners = new Set()
	add_listener( fn ) {
		this.listeners.add( fn )
		let rm = () => {
			this.listeners.delete( fn )
		}
		return rm
	}
	call_listeners( operation, operand ) {
		//console.log("call_listeners",operation, operand,[...this.listeners.values()])
		for (let fn of this.listeners.values()) {
			//console.log('calling fn',fn)
			fn( operation, operand )
		}
	}
}

// https://github.com/ai/nanoevents/blob/main/index.js
export let createNanoEvents = () => ({
  events: {},
  emit(event, ...args) {
    let callbacks = this.events[event] || []
    for (let i = 0, length = callbacks.length; i < length; i++) {
      callbacks[i](...args)
    }
  },
  on(event, cb) {
    this.events[event]?.push(cb) || (this.events[event] = [cb])
    return () => {
      this.events[event] = this.events[event]?.filter(i => cb !== i)
    }
  }
})
import * as F from "./lib.js"

export function scene( rapi, workers ) 
{
	return new Scene( rapi, workers )
}

class Scene {
	constructor( rapi, workers ) {
		this.rapi = rapi
		this.workers = workers
		this.ctx = F.create_ctx( this.rapi, this.workers )
	}
	generate() {

	}
}

class Item {
	constructor() {
		this.children = []
	}
	generate( ctx )
	{
		this.children.map( c => c.generate( ctx ))
	}
}

class Data extends Item {

}
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import * as CL2 from "/jsapi/cl2.js"
import * as API from "./app.js"
import * as UTILS from "./utils.js"

// https://codesandbox.io/p/sandbox/basic-threejs-example-with-re-use-dsrvn?file=%2Fsrc%2Findex.js%3A3%2C1-134%2C1


class Cube1 extends THREE.Mesh {
  constructor() {
    super()
    this.geometry = new THREE.BoxGeometry()
    this.material = new THREE.MeshStandardMaterial({ color: new THREE.Color('orange').convertSRGBToLinear() })
    this.cubeSize = 0
    this.cubeActive = false
  }

  render() {
    this.rotation.x = this.rotation.y += 0.01
  }

  onResize(width, height, aspect) {
    this.cubeSize = width / 5 // 1/5 of the full width
    this.scale.setScalar(this.cubeSize * (this.cubeActive ? 1.5 : 1))
  }

  onPointerOver(e) {
    this.material.color.set('hotpink')
    this.material.color.convertSRGBToLinear()
  }

  onPointerOut(e) {
    this.material.color.set('orange')
    this.material.color.convertSRGBToLinear()
  }

  onClick(e) {
    this.cubeActive = !this.cubeActive
    this.scale.setScalar(this.cubeSize * (this.cubeActive ? 1.5 : 1))
  }
}



////////////////////////////////
// плагины-фичи. удобно вызывать из конструкторов объектов
// todo но вообще это может модификаторы? посмотрим..
function add_position( obj ) {
  obj.position = CL2.create_channel()
  obj.position.subscribe( v => {
    	obj.tjs_node.position.set( ...v )
  })
}

function add_scale( obj ) {
  obj.scale = CL2.create_channel()
  obj.scale.subscribe( v => {
  	  if (Array.isArray(v))
    		obj.tjs_node.scale.set( ...v )
    	else
    		obj.tjs_node.scale.setScalar( v )    	
    })
}

function add_rotation( obj ) {
  obj.rotation = CL2.create_channel()
  obj.rotation.subscribe( v => {
    	obj.tjs_node.rotation.set( ...v )
    	//setScalar
    })
}

function add_color( obj ) {
  obj.color = CL2.create_channel()
  obj.color.subscribe( v => {
    	obj.material.color = somethingToColor(v);
    	obj.material.needsUpdate = true
    })
}

function add_radius( obj ) {
  obj.radius = CL2.create_channel()
  obj.radius.subscribe( v => {
    	obj.material.size = v;
    	obj.material.needsUpdate = true
    })
}

function add_positions( obj,records_per_item=3 ) {
  obj.positions = CL2.create_channel()
  obj.positions.subscribe( v => {
  	  let vv = new THREE.BufferAttribute( new Float32Array(v), records_per_item )
	  	obj.geometry.setAttribute( 'position', vv );
    	obj.geometry.needsUpdate = true;
   })
}

function add_radiuses( obj ) {
  obj.radiuses = CL2.create_channel()
  obj.radiuses.subscribe( v => {
  	  let vv = new THREE.BufferAttribute( new Float32Array(v), 1 )
	  	obj.geometry.setAttribute( 'radiuses', vv );
    	obj.geometry.needsUpdate = true;
   })
}

function add_colors( obj,records_per_item=3 ) {
  obj.colors = CL2.create_channel()
  obj.colors.subscribe( v => {	
   if (v) {
   	    // todo проверять может v уже буфер
   	    let vv = new THREE.BufferAttribute( new Float32Array(v), records_per_item )
	      obj.geometry.setAttribute( 'color', vv );
	      obj.material.vertexColors = true;
	    } else {
	      obj.geometry.deleteAttribute( 'color' );
	      obj.material.vertexColors = false; 
	    }
	    obj.geometry.needsUpdate = true;
    })
}

class TjsBase {
	constructor(tjs_node) {
		this.tjs_node = tjs_node
		this.release = CL2.create_channel()		
	}
	append_to(tgt) {
		tgt.tjs_node.add( this.tjs_node )
	}
}

class Cube extends TjsBase {
  constructor() {
  	super(new THREE.Mesh())
    this.tjs_node.geometry = this.geometry = new THREE.BoxGeometry()
    this.tjs_node.material = this.material = new THREE.MeshStandardMaterial({ color: new THREE.Color('orange').convertSRGBToLinear() })

    this.cubeSize = 100
    this.cubeActive = false

		add_color(this)		
		add_position(this)
		add_scale(this)
		add_rotation(this)

		//this.scale.submit()
		this.position.submit([1.5, 0, 3])
  }

  // эти штуки я временно выходит отключил но можно вернуть
  render() {
    //this.rotation.x = this.rotation.y += 0.01
  }

  onResize(width, height, aspect) {
    this.cubeSize = width / 5 // 1/5 of the full width
    this.tjs_node.scale.setScalar(this.cubeSize * (this.cubeActive ? 1.5 : 1))
  }

  onPointerOver(e) {
    //this.material.color.set('hotpink')
    //this.material.color.convertSRGBToLinear()
  }

  onPointerOut(e) {
    //this.material.color.set('orange')
    //this.material.color.convertSRGBToLinear()
  }

  onClick(e) {
    this.cubeActive = !this.cubeActive
    this.tjs_node.scale.setScalar(this.cubeSize * (this.cubeActive ? 1.5 : 1))
  }
}

class Lines extends TjsBase {
  constructor() {
  	super(new THREE.LineSegments())
  	// todo сделать что-то с этим. мб фичи переделать (add_color и тп)
    this.tjs_node.geometry = this.geometry = new THREE.BufferGeometry();
    this.tjs_node.material = this.material = new THREE.LineBasicMaterial( {} );

		add_color(this)
		add_radius(this)
		add_position(this)
		add_scale(this)
		add_rotation(this)

		add_positions(this)
		add_colors(this)
		//add_radiuses(this)

		// логика патча
		// todo оптимизировать
		let save_positions=[],save_colors=[]

		this.positions.subscribe( x => save_positions=x)
		this.colors.subscribe( x => save_colors=x)

		// idea еще и удалять чтоб
		// idea необязательные поля
	  this.patch = CL2.create_channel()
	  this.patch.subscribe( xtra => {
		    let pos = xtra.p;
		    let col = xtra.c;
		    this.colors.submit( save_colors.concat( col ));
		    this.positions.submit( save_positions.concat( pos ));	  			  	
	   })
  }
}

// todo может это вызывать из объектов да и все?
// а то многослойное чет усе
function create_c( rapi, klass, api_to_attr, descr ) {
	//console.log("create_c",descr)
	let obj = new klass()	
	UTILS.ch_assign_attrs( obj, api_to_attr, descr.params);
	UTILS.ch_bind_in_links( rapi, obj, api_to_attr, descr.links_in || {} )
	UTILS.ch_bind_out_links( rapi, obj,api_to_attr, descr.links_out || {})
	API.create_children( rapi, obj, descr )
	return obj
}

function cube(descr,rapi) 
{
	return create_c( rapi, Cube, {"scale":"scale","position":"position","rotation":"position","color":"color"}, descr)
}

function lines(descr,rapi)
{
	return create_c( rapi, Lines, 
		 {"scale":"scale","position":"position","rotation":"position","color":"color", "radius":"radius",
		"positions":"positions", "colors":"colors","patch":"patch"}, descr)
}

/*
function create_tjs_obj( tjs_node ) {
	
	let obj = {tjs_node}
	obj.append_to = tgt_id => {	
		tgt.tjs_node.add( that )
	}
	obj.release = CL2.create_channel()

	return obj
}
*/

function view(descr,rapi) 
{
	let obj = {}
	// state
	//let width = 1
	//let height = 1
	let intersects = []
	let hovered = {}

	// setup
	const scene = new THREE.Scene()
	const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
	camera.position.z = 5
	const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
	renderer.setPixelRatio(Math.min(Math.max(1, window.devicePixelRatio), 2))
	renderer.toneMapping = THREE.ACESFilmicToneMapping
	renderer.outputEncoding = THREE.sRGBEncoding

	const raycaster = new THREE.Raycaster()
	const mouse = new THREE.Vector2()

	// view
	/*
	const cube1 = new Cube()
	cube1.position.set(-1.5, 0, 0)
	const cube2 = new Cube()
	cube2.position.set(1.5, 0, 0)
	scene.add(cube1)
	scene.add(cube2)
	*/

	const ambientLight = new THREE.AmbientLight()
	const pointLight = new THREE.PointLight()
	pointLight.position.set(10, 10, 10)
	scene.add(ambientLight)
	scene.add(pointLight)

	const controls = new OrbitControls( camera, renderer.domElement );

	let installed_h=1, installed_w=1

	// responsive
	function maybe_resize() {		
		if (!obj.host_dom) return;
		//console.log("maybe_resize")
	  let width = obj.host_dom.clientWidth
	  let height = obj.host_dom.clientHeight
	  if (width == installed_w && height == installed_h) return;
	  if (height <= 0) return;
	  installed_w = width;
	  installed_h = height;

	  camera.aspect = width / height
	  const target = new THREE.Vector3(0, 0, 0)
	  const distance = camera.position.distanceTo(target)
	  const fov = (camera.fov * Math.PI) / 180
	  const viewportHeight = 2 * Math.tan(fov / 2) * distance
	  const viewportWidth = viewportHeight * (width / height)
	  camera.updateProjectionMatrix()
	  renderer.setSize(width, height)
	  scene.traverse((obj) => {
	    if (obj.onResize) obj.onResize(viewportWidth, viewportHeight, camera.aspect)
	  })
	}

	//window.addEventListener('resize', resize)
	//resize()

	// events
	/*
	window.addEventListener('pointermove', (e) => {
	  mouse.set((e.clientX / width) * 2 - 1, -(e.clientY / height) * 2 + 1)
	  raycaster.setFromCamera(mouse, camera)
	  intersects = raycaster.intersectObjects(scene.children, true)

	  // If a previously hovered item is not among the hits we must call onPointerOut
	  Object.keys(hovered).forEach((key) => {
	    const hit = intersects.find((hit) => hit.object.uuid === key)
	    if (hit === undefined) {
	      const hoveredItem = hovered[key]
	      if (hoveredItem.object.onPointerOver) hoveredItem.object.onPointerOut(hoveredItem)
	      delete hovered[key]
	    }
	  })

	  intersects.forEach((hit) => {
	    // If a hit has not been flagged as hovered we must call onPointerOver
	    if (!hovered[hit.object.uuid]) {
	      hovered[hit.object.uuid] = hit
	      if (hit.object.onPointerOver) hit.object.onPointerOver(hit)
	    }
	    // Call onPointerMove
	    if (hit.object.onPointerMove) hit.object.onPointerMove(hit)
	  })
	})
	*/

	window.addEventListener('click', (e) => {
	  mouse.set((e.clientX / installed_w) * 2 - 1, -(e.clientY / installed_h) * 2 + 1)
	  raycaster.setFromCamera(mouse, camera)
	  intersects = raycaster.intersectObjects(scene.children, true)

	  intersects.forEach((hit) => {
	    // Call onClick
	    if (hit.object.onClick) hit.object.onClick(hit)
	  })
	})

	// render-loop, called 60-times/second
	function animate(t) {
	  requestAnimationFrame(animate)
	  maybe_resize()

	  controls.update();
	  //console.log(camera.rotation)

	  scene.traverse((obj) => {
	    if (obj.render) obj.render(t)
	  })

	  renderer.render(scene, camera)
	}

	animate()

	obj.tjs_node = scene;

	obj.append_to = tgt_id => {
		let tgt = tgt_id.dom_node || document.getElementById( tgt_id )
		tgt.append( renderer.domElement )
		obj.host_dom = tgt
		maybe_resize()
	}
	obj.release = CL2.create_channel()
	obj.bgcolor = CL2.create_channel()

	obj.bgcolor.subscribe(v => {
		 scene.background = somethingToColor(v);
	})

	let api_to_attr = {"bgcolor":"bgcolor"}
	UTILS.ch_assign_attrs( obj, api_to_attr, descr.params);
	UTILS.ch_bind_in_links( rapi, obj, api_to_attr, descr.links_in || {} )
	UTILS.ch_bind_out_links( rapi, obj,api_to_attr, descr.links_out || {})
	API.create_children( rapi, obj, descr )

	const cube1 = new Cube1()
cube1.position.set(-1.5, 0, 0)
const cube2 = new Cube1()
cube2.position.set(1.5, 0, 0)
scene.add(cube1)
scene.add(cube2)

	return obj
}

function somethingToColor( theColorData )
{
    return theColorData?.length >= 3 ? new THREE.Color( theColorData[0], theColorData[1], theColorData[2] ) : new THREE.Color(theColorData);
}

export let types = {view,cube,lines}
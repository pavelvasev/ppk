import * as THREE from 'three';

import * as CL2 from "/jsapi/cl2.js"
import * as API from "./app.js"
import * as UTILS from "./utils.js"

// https://codesandbox.io/p/sandbox/basic-threejs-example-with-re-use-dsrvn?file=%2Fsrc%2Findex.js%3A3%2C1-134%2C1


/*
class View {
	constructor() {
	}
}
*/

class Cube extends THREE.Mesh {
  constructor() {
    super()
    this.geometry = new THREE.BoxGeometry()
    this.material = new THREE.MeshStandardMaterial({ color: new THREE.Color('orange').convertSRGBToLinear() })
    this.cubeSize = 100
    this.cubeActive = false
    this.node = this
  }

  render() {
    //this.rotation.x = this.rotation.y += 0.01
  }

  onResize(width, height, aspect) {
    this.cubeSize = width / 5 // 1/5 of the full width
    this.scale.setScalar(this.cubeSize * (this.cubeActive ? 1.5 : 1))
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
    this.scale.setScalar(this.cubeSize * (this.cubeActive ? 1.5 : 1))
  }
}

function cube(descr,rapi) 
{
	let c = new Cube()
}

function create_tjs_obj( tjs_node ) {
	
	let obj = {tjs_node}
	obj.append_to = tgt_id => {	
		tgt.tjs_node.add( that )
	}
	obj.release = CL2.create_channel()
	obj.remove = () => {
		obj.release.submit()
	}

	return obj
}

function view(descr,rapi) 
{
	// state
	let width = 0
	let height = 0
	let intersects = []
	let hovered = {}

	// setup
	const scene = new THREE.Scene()
	const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
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

	// responsive
	function resize() {
	  width = window.innerWidth
	  height = window.innerHeight
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

	window.addEventListener('resize', resize)
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
	  mouse.set((e.clientX / width) * 2 - 1, -(e.clientY / height) * 2 + 1)
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
	  scene.traverse((obj) => {
	    if (obj.render) obj.render(t)
	  })
	  renderer.render(scene, camera)
	}

	animate()

	let obj = {scene}

	obj.append_to = tgt_id => {
		let tgt = tgt_id.dom_node || document.getElementById( tgt_id )
		tgt.append( renderer.domElement )
	}
	obj.release = CL2.create_channel()

	return obj

}

function somethingToColor( theColorData )
{
    return theColorData?.length >= 3 ? new THREE.Color( theColorData[0], theColorData[1], theColorData[2] ) : new THREE.Color(theColorData);
}

export let types = {view,cube}
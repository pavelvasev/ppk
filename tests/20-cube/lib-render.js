/**
 * на основе jonaskello / https://github.com/jonaskello
   рисует множество кубиков по указанным координатам
   на одном ядре
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);  
const THREE = require("three");

// Use either named export or default export
//const SoftwareRenderer = require("./three-software-renderer").SoftwareRenderer;

const PNG = require("pngjs").PNG;
const fs = require("fs");

export function tarr2arr( tarr ) {
  let arr = new Array(); arr.length = tarr.length;
  for (let i=0; i<tarr.length; i++) arr[i] = tarr[i];
  return arr
}

export function join_imagedata( i1, i2 )
//export function join_imagedata( w,h,img1,zbuf1, img2, zbuf2 )
{
  //let i1 = { width: w, height: h, data:img1, zbuffer=img2 }
  let i=0,j=0
  for (let y=0; y<i1.height; y++)
    for (let x=0; x<i1.width; x++,i++,j+=4) {
      let z1 = i1.zbuffer[i]
      let z2 = i2.zbuffer[i]
      // z2 побеждает
      if ((z1 < 1.0 && z2 > 0.0) || (z2 > 0.0 && z2 < z1)) 
      {
      //if (z2 < z1 && (z2 > 0.0 && z1 > 0.0)) { 
      //if (z2 > z1) {
        //console.log("z2 value win",z2,"over",z1)
        i1.data[j] = i2.data[j]
        i1.data[j+1] = i2.data[j+1]
        i1.data[j+2] = i2.data[j+2]
        i1.data[j+3] = i2.data[j+3]
        i1.zbuffer[i] = i2.zbuffer[i]
      }
    }
  return i1;
}

export function bytes2png( bytes, w,h, path )  {
  const png = new PNG({
    width: w,
    height: h,
    filterType: -1
  });

  for(var i=0;i<bytes.length;i++) {
    png.data[i] = bytes[i];
  }
  //console.log(png.data);
  //return png
  png.pack().pipe(fs.createWriteStream(path));  
}

export function bytes2png_buffer( bytes, w,h )  {
  const png = new PNG({filterType: -1});
  png.width = w
  png.height = h
  png.data = bytes // там как раз буфер

  /*
  const png = new PNG({
    width: w,
    height: h,
    filterType: -1
  });
  */  
  /*for(var i=0;i<bytes.length;i++) {
    png.data[i] = bytes[i];
  } */ 

  //return png.pack()
  // https://www.npmjs.com/package/pngjs
  return PNG.sync.write(png)
}

export function imagedata2png( imagedata, path )  {
  const png = new PNG({
    width: imagedata.width,
    height: imagedata.height,
    filterType: -1
  });

  for(var i=0;i<imagedata.data.length;i++) {
    png.data[i] = imagedata.data[i];
  }
  //console.log(png.data);
  //return png
  png.pack().pipe(fs.createWriteStream(path));  
}


export function bytes2png_flipped( bytes, w,h, path )  {
  const png = new PNG({
    width: w,
    height: h,
    filterType: -1
  });

  console.log("saving bytes",bytes)
  let i=0
  // *** в pyrender флипают изображения
  for (let x=0; x<w; x++)
    for (let y=0; y<h; y++,i++)
      png.data[ x + y * w] = bytes[i];

  console.log(png.data)

  //console.log(png.data);
  //return png
  png.pack().pipe(fs.createWriteStream(path));  
}


// рендеринг кубиками
/* вход: 
     width height размеры растра
     positions colors положения и цвета кубиков (сплюснутый массив троек)
     sz размер одного кубика
   выход: imagedata { data, width, height, zbuffer}
*/
export function render_cubes( width, height, positions, colors, sz=1/1000.0 ) {

  // Build scene with cube
  //const width = 1024; const height = 768;
  //const width = 1600; const height = 1200;

  const camera = new THREE.PerspectiveCamera(75, width / height, 1, 10000);
  camera.position.set( 0.5, 0.5, 2)
  camera.lookAt( 0.5, 0.5, 0.5)

  const scene = new THREE.Scene();

  scene.add( cube2( positions, colors,sz ) )
  //const axesHelper = new THREE.AxesHelper( 1 );
  //scene.add( axesHelper );
  scene.add( axes() )

  // Render into pixels-array (RGBA)
  const renderer = new SoftwareRenderer( {canvas: {width,height}} );
  renderer.setSize(width, height);
  console.time("render")

  var imagedata = renderer.render(scene, camera);

  console.timeEnd("render")
  return imagedata;
}

// выдает функцию рендеринга
export function prepare_render_cubes( width, height, positions, colors, sz=1/1000.0 ) {

  // Build scene with cube
  //const width = 1024; const height = 768;
  //const width = 1600; const height = 1200;

  const camera = new THREE.PerspectiveCamera(75, width / height, 1, 10000);


  const scene = new THREE.Scene();

  scene.add( cube2( positions, colors,sz ) )
  //const axesHelper = new THREE.AxesHelper( 1 );
  //scene.add( axesHelper );
  scene.add( axes() )

  // Render into pixels-array (RGBA)
  const renderer = new SoftwareRenderer( {canvas: {width,height}} );
  renderer.setSize(width, height);

  let render_function = ( camera_pos=[ 0.5, 0.5, 2 ], camera_look_at=[0.5, 0.5, 0.5] ) => {
    camera.position.set( ...camera_pos )
    camera.lookAt( ...camera_look_at )
    console.time("render")
    var imagedata = renderer.render(scene, camera);
    console.timeEnd("render")
    return imagedata;
  }
  
  return render_function
}



function axes(sz=1) {
  let obj = new THREE.Object3D();

  obj.add( one( sz, sz/100, sz/100 ) )
  obj.add( one( sz/100, sz, sz/100 ) )
  obj.add( one( sz/100, sz/100, sz ) )
  return obj

  function one(a,b,c) {
    const geometry = new THREE.BoxGeometry(a,b,c);
    //const material = new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.1});
    const material = new THREE.MeshBasicMaterial({color: 0xffffff});
    const mesh = new THREE.Mesh(geometry, material);    
    return mesh
  }
}

function cube1() {
  let sz = 1 / 1000.0;

  let positions = [];
  let colors = []  
  for (let i=0; i<1000*100; i++) {
    positions.push( Math.random(),Math.random(),Math.random() )
    colors.push( Math.random(),Math.random(),Math.random() )
  }

  var res = makeBoxes( sz, 1,1,1, positions,
                        colors && colors.length > 0 ? colors : null,
                        null, 1 ); //1|2|4 );
  // похоже достаточно одной стороны, там все-равно пиксели 

  // https://threejs.org/docs/?q=geome#api/en/core/BufferGeometry
  const geometry = new THREE.BufferGeometry();
  // create a simple square shape. We duplicate the top left and bottom right
  // vertices because each vertex needs to appear once per triangle.
  const vertices = new Float32Array( res[0] );
  let indices = new Uint32Array(res[1])
  let fcolors = new Float32Array(res[2])

  // itemSize = 3 because there are 3 values (components) per vertex
  geometry.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
  geometry.setIndex( new THREE.BufferAttribute( indices, 1 ) );

  const material = new THREE.MeshBasicMaterial( { color: 0xff0000 } );

  if (colors.length > 0) {
    geometry.setAttribute( 'color', new THREE.BufferAttribute( fcolors, 3 ) );
    material.vertexColors = THREE.VertexColors;
    material.color = new THREE.Color( 0xffffff );
    material.needsUpdate = true;
  }
  

  const mesh = new THREE.Mesh( geometry, material );

  //console.log("mesh generated",vertices,indices)
  return mesh
}


// positions, colors
// output: mesh
// генерируем объект mesh
export function cube2( positions, colors,sz = 1 / 1000.0 ) {
  console.time("makeBoxes")
  var res = makeBoxes( sz, 1,1,1, positions,
                        colors && colors.length > 0 ? colors : null,
                        null, 1 ); //1|2|4 );
  console.timeEnd("makeBoxes")  
  // похоже достаточно одной стороны, там все-равно пиксели 

  // https://threejs.org/docs/?q=geome#api/en/core/BufferGeometry
  const geometry = new THREE.BufferGeometry();
  // create a simple square shape. We duplicate the top left and bottom right
  // vertices because each vertex needs to appear once per triangle.
  const vertices = new Float32Array( res[0] );
  let indices = new Uint32Array(res[1])
  let fcolors = new Float32Array(res[2])

  // itemSize = 3 because there are 3 values (components) per vertex
  geometry.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
  geometry.setIndex( new THREE.BufferAttribute( indices, 1 ) );

  const material = new THREE.MeshBasicMaterial( { color: 0xff0000 } );

  if (colors && colors.length > 0) {
    geometry.setAttribute( 'color', new THREE.BufferAttribute( fcolors, 3 ) );
    material.vertexColors = THREE.VertexColors;
    material.color = new THREE.Color( 0xffffff );
    material.needsUpdate = true;
  }
  

  const mesh = new THREE.Mesh( geometry, material );

  //console.log("mesh generated",vertices,indices)
  return mesh
}

///////////////////////////////////// новое

export function mkmesh( vertices, indices, fcolors ) {
  // https://threejs.org/docs/?q=geome#api/en/core/BufferGeometry
  const geometry = new THREE.BufferGeometry();
  // create a simple square shape. We duplicate the top left and bottom right
  // vertices because each vertex needs to appear once per triangle.


  // itemSize = 3 because there are 3 values (components) per vertex
  geometry.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
  geometry.setIndex( new THREE.BufferAttribute( indices, 1 ) );

  const material = new THREE.MeshBasicMaterial( { color: 0xff0000 } );

  if (fcolors && fcolors.length > 0) {
    geometry.setAttribute( 'color', new THREE.BufferAttribute( fcolors, 3 ) );
    material.vertexColors = THREE.VertexColors;
    material.color = new THREE.Color( 0xffffff );
    material.needsUpdate = true;
  }
  

  const mesh = new THREE.Mesh( geometry, material );

  //console.log("mesh generated",vertices,indices)
  return mesh
}

// по позициям ячеек генерирует информацию по мешу
// return [ poss, inds, cols ];
// sides=(1|2|4)
export function makeBoxes2( positions, colors, radius=1/1000.0, sizes=null, sides=1 ) {
  if (colors && colors.length == 0) colors = null

/* todo optimize
        let poss = new Float32Array();
        let inds = new Uint32Array()
        let cols = new Float32Array()
*/        
        var inds = [];
        var poss = [];
        var cols = [];


        // vertices
        var itemsCount = positions.length / 3;

        for (var q=0; q<itemsCount; q++) {
            var s1 = 3*q;
            var p = [ positions[s1], positions[s1+1], positions[s1+2] ];

            var color = null;
            if (colors) {
                var y1 = 3*q;
                color = [ colors[ y1 ],colors[ y1+1 ], colors[ y1+2 ] ]
            }

            //var bsize = sizes ? [ sizes[s1],sizes[s1 +1],sizes[s1+2] ] : [radius,radius,radius ];
            //var b = vMulScal( bsize, 0.5 );
            var b = [ radius / 2, radius /2 , radius / 2]

            var offset = poss.length / 3;

            var zz = p[2] - b[2];
            poss.push( p[0] - b[0] );
            poss.push( p[1] - b[1] );
            poss.push( zz );

            poss.push( p[0] + b[0] );
            poss.push( p[1] - b[1] );
            poss.push( zz );

            poss.push( p[0] + b[0] );
            poss.push( p[1] + b[1] );
            poss.push( zz );

            poss.push( p[0] - b[0] );
            poss.push( p[1] + b[1] );
            poss.push( zz );

            zz = p[2] + b[2];
            poss.push( p[0] - b[0] );
            poss.push( p[1] - b[1] );
            poss.push( zz );

            poss.push( p[0] + b[0] );
            poss.push( p[1] - b[1] );
            poss.push( zz );

            poss.push( p[0] + b[0] );
            poss.push( p[1] + b[1] );
            poss.push( zz );

            poss.push( p[0] - b[0] );
            poss.push( p[1] + b[1] );
            poss.push( zz );

            if (color) {
                cols.push( color[0] ); cols.push( color[1] ); cols.push( color[2] );
                cols.push( color[0] ); cols.push( color[1] ); cols.push( color[2] );
                cols.push( color[0] ); cols.push( color[1] ); cols.push( color[2] );
                cols.push( color[0] ); cols.push( color[1] ); cols.push( color[2] );

                cols.push( color[0] ); cols.push( color[1] ); cols.push( color[2] );
                cols.push( color[0] ); cols.push( color[1] ); cols.push( color[2] );
                cols.push( color[0] ); cols.push( color[1] ); cols.push( color[2] );
                cols.push( color[0] ); cols.push( color[1] ); cols.push( color[2] );
            }

            if (sides & 1) {
            // bottom
            inds.push( offset );
            inds.push( offset+2 );
            inds.push( offset+1 );

            inds.push( offset );
            inds.push( offset+3 );
            inds.push( offset+2 );

            // top
            inds.push( offset  +4 );
            inds.push( offset+1+4 );
            inds.push( offset+2+4 );

            inds.push( offset  +4 );
            inds.push( offset+2+4 );
            inds.push( offset+3+4 );
            }
  

            if (sides & 2) {
            // near
            inds.push( offset );
            inds.push( offset+1 );
            inds.push( offset+5 );

            inds.push( offset );
            inds.push( offset+5 );
            inds.push( offset+4 );

            // far
            inds.push( offset  +3 );
            inds.push( offset+6 );
            inds.push( offset+2 );

            inds.push( offset  +3 );
            inds.push( offset+7 );
            inds.push( offset+6 );
            }

            ////////// 
            // left
            if (sides & 4) {
            inds.push( offset );
            inds.push( offset+7 );
            inds.push( offset+3 );

            inds.push( offset );
            inds.push( offset+4 );
            inds.push( offset+7 );

            // right
            inds.push( offset+1 );
            inds.push( offset+2 );
            inds.push( offset+6 );

            inds.push( offset+1 );
            inds.push( offset+6 );
            inds.push( offset+5 );
            }

        }

        //return [ poss, inds, cols ];
        return [ new Float32Array(poss), new Uint32Array(inds), new Float32Array(cols) ];
    }

export function prepare_render_function_1( width, height ) {

  // Build scene with cube
  //const width = 1024; const height = 768;
  //const width = 1600; const height = 1200;

  const camera = new THREE.PerspectiveCamera(75, width / height, 1, 10000);


  const scene = new THREE.Scene();

  // scene.add( mkmesh( positions,indices, colors ) )
  //const axesHelper = new THREE.AxesHelper( 1 );
  //scene.add( axesHelper );
  scene.add( axes() )

  // Render into pixels-array (RGBA)
  const renderer = new SoftwareRenderer( {canvas: {width,height}} );
  renderer.setSize(width, height);

  // mesh_info = [ pos, ind, cols]
  let render_function = ( mesh_info, camera_pos=[ 0.5, 0.5, 2 ], camera_look_at=[0.5, 0.5, 0.5] ) => {
    camera.position.set( ...camera_pos )
    camera.lookAt( ...camera_look_at )
    console.time("mkmesh")
    let mesh = mkmesh( ...mesh_info ) 
    console.timeEnd("mkmesh")
    scene.add( mesh )
    console.time("render")
    var imagedata = renderer.render(scene, camera);
    console.timeEnd("render")
    //console.time("render2")
    //renderer.render(scene, camera);
    //console.timeEnd("render2")
    scene.remove( mesh )
    return imagedata;
  }
  
  return render_function
}

// выдает функцию рендеринга для меша, заданного positions indices colors
// вообще это похоже придется разбить на отдельно - таки - создание сцены
// и отдельно - на подгрузку в эту сцену данных
// выдает функцию рендеринга по mesh_info = [positions, indices, colors]
export function prepare_render_function( mesh_info, width, height ) {

  // Build scene with cube
  //const width = 1024; const height = 768;
  //const width = 1600; const height = 1200;

  let z_near = 1
  let z_far = 10000
  const camera = new THREE.PerspectiveCamera(75, width / height, z_near, z_far);
  const scene = new THREE.Scene();

  scene.add( mkmesh( ...mesh_info ) )
  scene.add( axes() )

  // Render into pixels-array (RGBA)
  
  const renderer = new SoftwareRenderer( {canvas: {width,height}} );
  renderer.setSize(width, height);

  let render_function = ( camera_pos=[ 0.5, 0.5, 2 ], camera_look_at=[0.5, 0.5, 0.5] ) => {
    console.log("sw render invoked wh=",{width,height})
    camera.position.set( ...camera_pos )
    camera.lookAt( ...camera_look_at )
    console.time("render")
    var imagedata = renderer.render(scene, camera);
    console.timeEnd("render")
    console.log("imagedata=",imagedata)

    // а теперь финт ушами - приведем з к формату питона.. (решил тут сделать)
    // т..е к линейным ед. изм. как в 
    // https://github.com/mmatl/pyrender/blob/a59963ef890891656fd17c90e12d663233dcaa99/pyrender/renderer.py#L274
    // https://sites.google.com/site/cgwith3js/home/depth-buffer-visualization
    
    let newzbuf = new Float32Array( imagedata.zbuffer.length )
    let i = 0
    let maxZVal = ( 1 << 24 );
    let viewportZOffs = maxZVal / 2 + 0.5;
    let viewportZScale = maxZVal / 2;

    for (let y=0; y<height; y++)
    for (let x=0; x<width; x++,i++) {
      let gl_z_norm = (imagedata.zbuffer[i] - viewportZOffs) / viewportZScale
      //gl_z_norm = 2 * gl_z_norm - 1 ;
      newzbuf[i] = ((2.0 * z_near * z_far) /
                    (z_far + z_near - (gl_z_norm) * (z_far - z_near)))
    }
    let resimagedata = { ... imagedata }
    resimagedata.zbuffer = newzbuf

    //return Promise.resolve( imagedata );
    return resimagedata
  }
  
  return render_function
}
//export function f(arg) {

export let f = (arg) => {
       let p = arg.input
       //console.log("input is",p)
       //let nx = new Float32Array( p.length )
       let jmax = p.length-1
       let p_left = p[0]
       let p_my   = 0
       let p_right = 0
       for (let j=1; j<jmax; j++) {
         p_my = p[j]
         p_right = p[j+1]
         p[j] = (p_left + p_right)/2 + Math.random(1)
         p_left = p_my
       }
       //p_next[j] = (p[j-1] + p[j+1])/2 + Math.random(1)
       //console.log("computed",p)
       return p
}

// это для параллельной версии
export let f_part = (arg) => {
   //console.log("arg is",arg)
       let p = arg.input.payload[0]
       
       //let nx = new Float32Array( p.length )
       let jmax = p.length-1
       p[ 0 ] = arg.left_block ? arg.left_block.right : 0
       p[ p.length-1 ] = arg.right_block ? arg.right_block.left : 0
       let p_left = p[0]
       let p_my   = 0
       let p_right = 0
       for (let j=1; j<jmax; j++) {
         p_my = p[j]
         p_right = p[j+1]
         p[j] = (p_left + p_right)/2 + Math.random(1)
         p_left = p_my
       }
       //p_next[j] = (p[j-1] + p[j+1])/2 + Math.random(1)
       //console.log("computed",p)
       return {payload:[p],left:p[1], right:p[p.length-2]}
}

// это для параллельной версии
export let f_part_div = (arg) => {
   //console.log("arg is",arg)
       let p = arg.input.payload[0]
       //let nx = new Float32Array( p.length )
       let jmax = p.length-1
       for (let j=1; j<jmax; j++) {
         p[j] = p[j] * 0.5
       }
       //p_next[j] = (p[j-1] + p[j+1])/2 + Math.random(1)
       //console.log("computed",p)
       return {payload:[p],left:p[1], right:p[p.length-2]}
}

////////////////////////////// шаблоны!

/* F-INDEX - передача индекса
   F-SCRATCH - создание данных с нуля (возможно, с доп. аргументом)
*/

// применяет указанную функцию над элементами 1-мерного блока 
// + соседи
export let f_part_call = (arg) => {
   //console.log("arg is",arg)
       let p = arg.input.payload[0]
       let f = arg.f

       //let nx = new Float32Array( p.length )
       let jmax = p.length-1
       p[ 0 ] = arg.left_block ? arg.left_block.right : 0
       p[ p.length-1 ] = arg.right_block ? arg.right_block.left : 0
       let p_left = p[0]
       let p_my   = 0
       let p_right = 0
       for (let j=1; j<jmax; j++) {
         p_my = p[j]
         p_right = p[j+1]
         p[j] = f( p_my, p_left, p_right, j-1 )
         p_left = p_my
       }
       //p_next[j] = (p[j-1] + p[j+1])/2 + Math.random(1)
       //console.log("computed",p)
       return {payload:[p],left:p[1], right:p[p.length-2]}
}

// применяет указанную функцию над элементами 1-мерного блока 
// без соседей
export let f_part_single_call = (arg) => {
   //console.log("arg is",arg)
       let p = arg.input.payload[0]
       let f = arg.f
       //let nx = new Float32Array( p.length )
       let jmax = p.length-1
       for (let j=1; j<jmax; j++) {
         p[j] = f(p[j],j-1)
       }
       //p_next[j] = (p[j-1] + p[j+1])/2 + Math.random(1)
       //console.log("computed",p)
       return {payload:[p],left:p[1], right:p[p.length-2]}
}
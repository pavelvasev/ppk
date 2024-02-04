// размер сетки
export let DN=1000*1000

// кол-во исполнителей
// важно - размер сетки должен делиться без остатка на кол-во исполнителей
export let P=4

// вычисление значений функции одного переменного по явной схеме
// вход:
//   arg.input - сетка значений в форме массива
// выход:
//   обновлённые значения в том же массиве
export let f = (arg) => {

       let p = arg.input
       let jmax = p.length-1
       let p_left = p[0]
       let p_my   = 0
       let p_right = 0

       for (let j=1; j<jmax; j++) {
         p_my = p[j]
         p_right = p[j+1]
         p[j] = (p_left + p_right)/2 + Math.random(1) // вычисляемая функция
         p_left = p_my
       }       

       return p
}

// параллельная версия - другая форма аргументов
// вход:
//   arg.input.payload - один блок (часть расчетной сетки) в форме массива
//   arg.left_block.right - граничное значение блока слева
//   arg.right_block.left - граничное значение блока справа
// выход:
//   обновлённые значения блока в том же массиве + граничные значения
export let f_part = (arg) => {   

       //console.error("fpart called. arg=",arg)

       let p = arg.input.payload[0]       
       
       let jmax = p.length-1
       
       let p_left = arg.left_block ? arg.left_block.right : 0
       let p_my = 0
       let p_right = 0

       for (let j=0; j<jmax; j++) {
         p_my = p[j]
         p_right = p[j+1]
         p[j] = (p_left + p_right)/2 + Math.random(1)
         p_left = p_my
       }

       // последний узел сетки
       p_my = p_right
       p_right = arg.right_block ? arg.right_block.left : 0
       p[jmax] = (p_left + p_right)/2 + Math.random(1)

       //console.error("fpart finished. p=",p)
       
       return {payload:[p],left:p[0], right:p[p.length-1]}
}
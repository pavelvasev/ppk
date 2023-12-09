#!/usr/bin/env node

export class Korzinka {
  constructor(rapi,crit,ms) {
    console.log("creating korzinka ",{crit,ms})
    this.crit = crit
    this.ms = ms
    this.storage = new Set()
    this.usage_counter = 1
    this.rapi = rapi
    this.kcounter=0
    
    let counter=0

    this.q = rapi.query(crit).done( msg => {
      //console.log(counter++,"catched msg",msg.label)
      let record = { m: msg, time: performance.now() }
      msg.timestamp ||= record.time; // сохраним еще и туды
      this.storage.add( record )
    })
    

/*  будущая красивая версия
    ну либо вообще можно так-то сделать подписаться на "новые реакции такого-то типа"
    и пусть их мейн высылает еще и сообщениями

    todo: понять конкретно, разобрать, почему мне тут это не подошло.
    там же была идея - всегда делаем get_list, храним его, и посылаем в него сообщения.
    а потом когда он становится не нужен - удаляем. и тут бы это прекрасно прокатило.
    но нет же, что-то пошло не так..
    похоже из-за авто-очистки.. что а) считалось что список один, б) что вот если нет в нем реакций то end-listen-list.
    а кстати какого ежа?.. хм, ну типа чтобы просто память не держать - это было для коротких списков.
    ну и не страшно же типа - ибо - ну пропустим туда сообщение еще раз и он подкачается.
    кстати это же вообще глюк.. но нет не глюк - потому что мы удаляем его из кеша.
    и потом будет честное повторное обращение.

    короче разобрать

    this.list_p = rapi.get_list( crit ).then( list => {
      list.on_added
    })
*/    
  }

  // приехала новая реакция
  set( name, reaction ) {
    
    let rapi = this.rapi
    let aa = reaction.action.arg
    //console.log("catched reaction",{name,reaction,aa})

    rapi.process_reaction_value( reaction )
    
    if (!reaction.test) reaction.test = ()=>true
    if (!reaction.test.bind) reaction.test = eval( reaction.test )
    //if (!reaction.action.bind) reaction.action = eval( reaction.action )

    // приехала новая реакция - пропустим ее через значения
    // в этот момент.. ее возможно захотят отозвать.. не выйдет )))))
    // ну либо в промисы перебор упаковывать  
    //console.log("passing values. have total=",this.storage.size)

    let cnt = 0
    for (let record of this.storage.values()) {
      let m = record.m
      //console.log(cnt++,'/',this.kcounter++,'KORZINKA-CMD m=',m,'reaction.arg=',aa)
      if (!reaction.test( m, reaction.arg )) continue
      reaction.action( m, reaction.arg )
    }
  }
  
  // todo очистка памяти по ms

  add_use() {
     this.usage_counter++ 
  }
  remove_use() {
    this.usage_counter--
    
  }
  is_used() {
    return (this.usage_counter > 0)
  }

  dispose() {
    //this.list_ws.send( JSON.stringify({end_listen_list:this.crit}) )
  }
}
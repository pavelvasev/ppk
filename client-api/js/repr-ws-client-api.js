// веб вебсокет клиентское апи для яваскрипт для веб-браузеров
// на основе представителя repr-ws

/*
   надо бы еще get_payload и т.п. но пока вроде как не надо.
   png запакую прямо в сообщение да и все. а так.. ну на репр надо будет поднять тогда еще
   и веб-сервер для прокси получается. ну либо таки пусть пейлоады тоже по ws гонит,
   в принципе какая разница.

   ну да, при необходимости можно реализовать get_payload для прокси. пока просто вроде не надо.

   проверил - сколько-то сообщений с 100кб массив рандом ать раз в секунду приходят.
   для просмотра кубика хватит
   ну потом да, можно будет сделать и get_payload метод для прокси. todo
   идея - заказываем пейлоад, оттуда как готово присылают флаг, а следующее сообщение блобом (т.е. не жсон)
*/

//import {compute_need_id, client_methods} from "./mem-client-api.js"

// хочется клиенту мозга узнавать - есть ли соединение и тп.. мб res совместить с ws, или засунуть ws в res, или создать свои события.. короче нужны мостики для этово
// todo перейти с позиционных на опции - так короче будет. а то еще payload_node_url
export function connect( sender, url = "ws://127.0.0.1:12000", verbose, submit_payload_url = "http://127.0.0.1:3333" ) {

  /*
  function generate_uniq_query_id( prefix ) {
    return `${sender}_${prefix}_${counter++}_of_${crypto.randomUUID()}_[rand_${Math.floor( Math.random()*10000 )}]`;
  }*/

  let rapi = new ReprWsClientApi( url )
  return new Promise( (resolve,reject) => {
    rapi.ws.addEventListener('open', (data) => {
      console.log('ws connected')
      resolve(rapi)
    })
    rapi.ws.addEventListener('close', (data) => {
      console.log('ws disconnected')
      rapi.closed.resolve( data )
    })
    rapi.ws.addEventListener('error', (data) => {
      console.log('ws error',data)
      //resolve(rapi)
      //rapi.closed.resolve( data )
      reject(rapi)
    })
  })
}

// https://stackoverflow.com/a/7616484
// https://gist.github.com/hyamamoto/fd435505d29ebfa3d9716fd2be8d42f0
function hashCode(s) {
  var hash = 0,
    i, chr;
  if (s.length === 0) return hash;
  for (i = 0; i < s.length; i++) {
    chr = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

class ReprWsClientApi {
  constructor( endpoint_url ) {
    console.log("ReprWsClientApi started:",endpoint_url)

    this.client_id = "webclient_"+hashCode(window.navigator.userAgent)+"_"+Math.ceil( Math.random() * 10000000 )

    let ppr
    this.closed = new Promise( (resolve) => {      
        ppr = resolve
    })
    this.closed.resolve = ppr

    this.ws = new WebSocket( endpoint_url )

    // необходимо чтобы payload входящие были не блобами а array-buffer-ами
    // this.ws.binaryType = "arraybuffer"; // #F-PACK-SEND 
    // оказалось не катит, нам для картинок надо blob

    let have_payload = null;
    
    this.ws.addEventListener('message', (event) => {
       //console.log("client got message",event)       

       let data = event.data

       if (data instanceof Blob) {
         have_payload = data;
         return;
       }

       /*
       if (data instanceof ArrayBuffer) {
         have_payload = data;
         return;
       }*/

       let json = JSON.parse(data)
       if (json.query_reply) {
         let cb =  this.query_dic[json.query_reply]
         //console.log("REPR-WS: got message",json.m,"passing to cb",cb)
         if (!cb) {
          console.error('no query with id ',json.query_reply)    
          return
         }

         json.m.timestamp ||= this.server_t0 + performance.now() // но может это и не здесь надо..

         if (have_payload) {
           let payload = have_payload;
           have_payload = null;
           deserialize_from_network( json.m, payload ).then( m => {
               cb( m )
           })
         }
         else
         cb( json.m )

       } else
       if (json.shared_reply) {
         // это обновление значений списков
         json.m.timestamp ||= this.server_t0 + performance.now() // но может это и не здесь надо..
         let cb=  this.shared_dic[json.shared_reply]
         if (cb) 
            cb( json.m )
          else console.error('no share with id ',json.shared_reply)
       }
       else if (json.hello) {
         this.server_t0 = json.server_t0
       }
       else console.log("cannot understand message",json)
    })
  }

  msg( m ) {
    //console.log("client sending ",m)
    // получается нагрузку отсюда не отправишь..
    return this.ws.send( JSON.stringify(m) )
  }

  query_counter=0
  query_dic = {}
  query( crit, opts, arg ) {
    let qid = `${this.client_id}/q_${this.query_counter++}`
    //console.log("client sending new query:",{query: qid, crit, opts, arg})
    opts ||= {}
    opts["N"] ||= -1
    this.msg( {query: qid, crit, opts, arg} )
    let that = this
    let res = {
      done(cb) {
        that.query_dic[ qid ] = cb
        return res
      },
      delete() {
        this.msg( {query_delete: qid} )
      }
    }
    return res
  }

  shared_dic = {}
  shared( crit ) {
    let qid = `${this.client_id}/s_${this.query_counter++}`
    //console.log("client sending ")
    this.msg( {shared: qid, crit} )
    let that = this
    let res = {
      subscribe(cb) {
        that.shared_dic[ qid ] = cb
      }
    }
    return res
  }

  shared_writer_dic = {}  
  shared_list_writer( crit,id ) {
    id ||= `${this.client_id}/sw_${this.query_counter++}`    
    let that = this
    let res = {
      id,
      submit(value) {
        //console.log(":shared_list_writer submits",{shared_submit: true, crit, value,opts:{id}})
        that.msg( {shared_submit: true, crit, value,opts:{id}} )
      }
    }
    return res
  }
}


/// #F-PACK-SEND
function deserialize_from_network(msg,payload) {

    if (!msg.decoder) {
      msg.payload = payload;
      return Promise.resolve( msg )
    }

    if (msg.decoder.type == "array") {
      return payload.arrayBuffer().then( arrayBuffer => {
         let arr = parseNumpyArray( arrayBuffer, msg.decoder.etype )  
         msg.value = arr  
         return msg
      })      
    } 
    else {      
      console.error("ppk: deserialize_from_network: unknown decoder type. msg=",msg)
      msg.payload = payload;
      return Promise.resolve( msg )
    }    
}

// Функция для преобразования ArrayBuffer в соответствующий тип массива
function parseNumpyArray(buffer, etype) {
  const dtype = etype;
  
  // Определяем тип данных и создаем соответствующий TypedArray
  if (dtype == 'float32') {
    return new Float32Array(buffer);
  } 
  else if (dtype == 'float64') {
    return new Float64Array(buffer);
  } 
  else if (dtype == 'int8') {
    return new Int8Array(buffer);
  } 
  else if (dtype == 'uint8') {
    return new Uint8Array(buffer);
  } 
  else if (dtype == 'int16') {
    return new Int16Array(buffer);
  } 
  else if (dtype == 'uint16') {
    return new Uint16Array(buffer);
  } 
  else if (dtype == 'int32') {
    return new Int32Array(buffer);
  } 
  else if (dtype == 'uint32') {
    return new Uint32Array(buffer);
  } 
  else if (dtype == 'bool') {
    return Array.from(new Uint8Array(buffer)).map(Boolean);
  } 
  else if (dtype == 'U') {
    // Для Unicode строк (предполагаем UTF-16)
    return Array.from(new Uint16Array(buffer))
      .map(code => String.fromCharCode(code));
  } 
  else {
    console.warn("ppk: parseNumpyArray: Неизвестный тип данных: ${dtype}");
    return new Uint8Array(buffer);
  }
}
             
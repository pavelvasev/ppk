/////////////////////////////////////

export default function init( rapi, payload_node_url ) {
  return new PayloadApi( rapi, payload_node_url )
}

// загрузить нагрузку на указанный пейлод-узел
// вернуть мета-инфу о загрузке в форме промиса
// todo перейти на fetch т.к. node-fetch

// а точнее тут идет - загрузка в локальную пушу 
// с припиской к результату глобального ip
import * as http from 'node:http';

class PayloadApi {

  constructor( rapi, payload_node_url ) {
    this.payload_node_url = payload_node_url
    this.rapi = rapi
  }

// todo оптимизировать - перейди на 2-такнтую схему оптравки (аллок номера + пуш)
 submit_payload( payload_array ) {
  //console.error('submit_payload called',{payload_array, payload_node_url})
  let proms = []
  let single_mode = false

  if (payload_array.buffer)
  {
    single_mode = true
    payload_array = [payload_array]
  }

  if (payload_array && payload_array.length > 0)
      console.time("submit-payloads")

  if (payload_array)
  for (let i=0; i<payload_array.length; i++) {
    let item = payload_array[i];

    const options = {
      hostname: '127.0.0.1',
      port: 3333,
      path: '/',
      method: 'POST'
    };

    let pp = new Promise( (resolve,reject) => {
      //let bytes = -1
      const req = http.request(options, (res) => {
          res.on('data', (data) => {
            //console.log(`BODY: ${data}`);
            console.error("submit_payload: upload request resolved, data=",data)
            resolve({
              url: this.payload_node_url + data,
              type: item.constructor.name,
              bytes_count, // F-PAYLOAD-BYTES-COUNT
              length: item.length // получается это так просто для справки-отладки. ну ок.
              // length - кол-во итемов. а не байтов.
            })
          });
          res.on('end', () => {
            //console.log('No more data in response.');
          });
          
      });
      req.on('error', (e) => {
        console.error(`submit_payload: problem with request: ${e.message}`,this.payload_node_url);
        reject(e)
      });
      //console.log('making buffer from arraybuffer')
      // в качестве пейлоада берем буферы и типизированные массивы
      let buffer = Buffer.isBuffer( item ) ? item : Buffer.from( new Uint8Array(item.buffer) );
      let bytes_count = buffer.length
      //console.log( 'done')
      req.write(buffer);
      req.end();
      //console.log('req end')
    })

    proms.push( pp )
  }

  //console.log('submit_payload ret',proms)
  let rrr = Promise.all( proms )
  if (payload_array && payload_array.length > 0)
      rrr.then( () => console.timeEnd("submit-payloads"))

  if (single_mode)
    return rrr.then( arr => arr[0] )

  return rrr
}

//////////////////////////

  get_one_payload (payload_record) {

    if (!payload_record.url) {
      console.error('get_one_payload: record have no url! record=',payload_record)
      return Promise.resolve(null)
    }

    // этот метод не требует дополнительного хранения actor-id в сообщениях
    let spos = payload_record.url.lastIndexOf( "/" )
    if (spos >= 0) {
      let s = payload_record.url.slice( 0, spos )
      //console.log("comparing",s,this.rapi.payloads_inmem.endpoint_url)
      if (s == this.rapi.payloads_inmem.endpoint_url) {
        let index = parseInt( payload_record.url.slice( spos+1 ) )
        //console.log("index is", index )
        let have = this.rapi.payloads_inmem.payloads.get( index )
        //console.log("have=",have)
        if (have) {
          //this.rapi.payloads_inmem.payloads.delete( index ) // тест
          return Promise.resolve( have )
        }
      }
    }

/*
    if (payload_record.url[0] == this.rapi.payloads_inmem.endpoint_url) {
      let have = this.rapi.payloads_inmem.payloads.get( payload_record.url[1] )
      if (have) {
        //console.log("payload HYPER-TRANSPORTed")
        return have
      }
    }
    */

/*
    if (payload_record.actor_id == this.rapi.actor_id) {
      let have = this.rapi.payloads_inmem.payloads.get( payload_record.internal_id )
      if (have) {
        //console.log("payload HYPER-TRANSPORTed")
        return have
      }
    }
*/    

    //console.error('get-one-payload',payload_record.url )
    console.time(`get-one-payload:${payload_record.url}` )
    return fetch( payload_record.url ).then( response => {
      return response.arrayBuffer()
    }).then( ab => {
      console.timeEnd(`get-one-payload:${payload_record.url}` )
      //console.error('get-one-payload',payload_record.url,'loaded, bytes len=',ab.byteLength )
      // https://gist.github.com/jonathanlurie/04fa6343e64f750d03072ac92584b5df
      var context = typeof window === "undefined" ? global : window;
      return new context[ payload_record.type ]( ab );
    })
  }
  
  // загружает из пуши все нагрузки
  // ну это спорное. может там могли бы поштучно их изымать. ну ладно.  
  // а также - может быть стоит их потоками выдавать
  get_payloads(payload_records_array) {
    //console.time("get-payloads")
    let load_payloads = payload_records_array.map( x => this.get_one_payload(x) )
    let res1 = Promise.all( load_payloads )
    //res1.then( () => console.timeEnd("get-payloads"))
    return res1
  }

  // загружает из пуши одну нагрузку или несколько, если подан массив
  // это эксперимент: сделать зергкально к submit_payload который тоже научен загружать
  // одну нагрузку или массив нагрузок.
  get_payload(payload_info) {
    let single_mode = (!Array.isArray(payload_info))
    if (single_mode)
      payload_info = [payload_info]
    let res = this.get_payloads( payload_info )
    if (single_mode)
      return res.then( arr => arr[0] )
    return res
  }

}  

/////////////////////////////////////

/* todo: 
    * cleanup ниды => выгрузка пейлода на пуша-сервер и постановка редиректа
*/

import {httpClose} from "./old/query.js"
import * as http_m from 'http'
import url from 'node:url'

export default function init( rapi, payload_node_url, limits ) {
  return new PayloadApiInmem( rapi, payload_node_url, limits )
}

/////////////////////////////////////////////  

export class PayloadApiInmem {

  payloads = new Map()
  counter = 0

  constructor( rapi, payload_node_url, limits) {
    this.payload_node_url = payload_node_url
    this.limits = limits
    this.rapi = rapi

    this.pusha_server ||= start_local_pusha_server( this )
    rapi.init_promises.push( this.pusha_server )
    this.pusha_server.then( (info) => {    
      let {srv,my_endpoint_url} = info
      this.srv = srv
      this.my_endpoint_url = my_endpoint_url
    })
  }

 // вернуть промису с payload_info - одной штучкой или массивом
 // payload_array - набор пейлоадов в памяти или 1 штучка. но лучше уж набор чтоб был всегда - удобно мыслить.
 submit_payload_inmem( payload_array ) {
    //throw new Error("test error")
    //console.log("hello world! inmem",payload_array)
    //console.log('submit_payload called',payload_array)

    let single_mode = false

    if (payload_array.buffer)
    {
      single_mode = true
      payload_array = [payload_array]
    }

    //this.pusha_server ||= start_local_pusha_server( this )
    
    // нам надо узнать my_endpoint_url
    //return this.pusha_server.then( (info) => {
      let {srv,my_endpoint_url} = this

      let result = []
      
      for (let i=0; i<payload_array.length; i++) {
        let item = payload_array[i];

        let item_res = item.inmem_payload_record
        if (!item_res) {
          //console.log("payload out miss")
          let id = this.counter++        
          this.payloads.set( id, item )                    
          item_res = {
                    url: `${my_endpoint_url}/${id}`,
                    //url: [my_endpoint_url,id],
                    //fid: [this.rapi.actor_id, id],
                    //iid: id,
                    type: item.constructor.name,
                    bytes_count: item.buffer.length, // F-PAYLOAD-BYTES-COUNT
                    length: item.length // получается это так просто для справки-отладки. ну ок.
                    // length - кол-во итемов. а не байтов.
                    }
          item.inmem_payload_record = item_res
        } //else console.log("payload out hit")

        /*
        let id = item._payloads_id // повторно положили?

        if (!id) {
          id = this.counter++        
          this.payloads.set( id, item )          
          item._payloads_id = id // запомним что она в списке
        }
        // todo: чистим память, ставим редиректы
        let bytes_count = item.buffer.length; // ну пока мы ее считаем тут TypedArray
        // byteLength - это кол-во байт используемые в буфере а они могут быть кратные страницам

        //console.log("AAA=",this.rapi.actor_id)

        let item_res = {
          url: `${my_endpoint_url}/${id}`,
                    //url: [my_endpoint_url,id],
                    //fid: [this.rapi.actor_id, id],
                    //iid: id,
                    type: item.constructor.name,
                    bytes_count, // F-PAYLOAD-BYTES-COUNT
                    length: item.length // получается это так просто для справки-отладки. ну ок.
                    // length - кол-во итемов. а не байтов.
                    }
        */
        result.push( item_res )
      }

      //return Promise.resolve( single_mode ? result[0] : result )
      return Promise.resolve( single_mode ? result[0] : result )
    //})
  }

}

// по сути это представитель пуши

function start_local_pusha_server( payload_api, port=11000,host='0.0.0.0',allow_find_free_port=true) {
    let server = http_m.createServer( {keepAlive: true},process_incoming )
    httpClose({ timeout: 2000 }, server)
        
    server.keepAliveTimeout = 60*1000*30 // сдался.. 30 минут таймаут ставлю кипалайва.. потому что note-fetch отваливается.. не помогает ему мой патч..
    
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        if (allow_find_free_port) {
          //console.log('Address in use, retrying...');
          port = port+1;
          server.listen( port,host );
        }
        else {
          throw e
        }
      }
    });

    server.listen( port,host );

    return new Promise( (resolve, reject) => {

      server.on("listening",() => {        
        //console.log('http server started: http://%s:%s', server.address().address, server.address().port);
        //server.address().address
        let adr = process.env['PPK_PUBLIC_ADDR'] || '127.0.0.1'
        let my_endpoint_url = `http://${adr}:${server.address().port}`
        payload_api.endpoint_url = my_endpoint_url
        console.log('inmem-pusha http server started at:', server.address(),"returning my_endpoint_url=",my_endpoint_url);
        //console.log({my_endpoint_url})
        resolve( {server,my_endpoint_url} )
      });

    })
    

    function process_incoming( request, response ) {
      //console.log("--------> inmem-pusha request, url=",request.url)

      var urla = url.parse(request.url,true);

      request.on('error',(err) => {
        console.error('request error',err)
      })
      response.on('error',(err) => {
        console.error('response error',err)
      })        
    
        if (request.headers.origin) {
            //const u =  url.parse ( request.headers.referer );
            response.setHeader( "Access-Control-Allow-Origin",request.headers.origin ); // F-REQESTER-CORS
            response.setHeader( "Access-Control-Allow-Headers","Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, If-Modified-Since, ETag" );
            response.setHeader( "Access-Control-Allow-Methods","GET,HEAD,OPTIONS,POST,PUT" );
            response.setHeader( "Access-Control-Allow-Private-Network","true")
        }

      let id = parseInt(urla.pathname.slice(1));

      try {
        let pp = payload_api.payloads.get(id)
        if (!pp)
            throw `File not exist: ${id}`

        if (pp.offloaded) {
          // делаем редирект
          throw new Error("redirect not implemented yet")
        }

        // а надо ли нам тут ct? это еще актуально?
        let bytes_count = pp.buffer.byteLength
        response.writeHead(200, {
            'Content-Type': urla.query.ct || 'application/binary', // не знаю норм или другое надо
            'Content-Length': bytes_count
        });
        // https://github.com/nodejs/node/issues/45497
        // https://github.com/nodejs/undici/issues/1414

        // We replaced all the event handlers with a simple call to readStream.pipe()
        let streaming_key = `inmem-pusha stream-out: ${urla.pathname}-${process.env.PPK_PUBLIC_ADDR}->${request.socket.remoteAddress} (${bytes_count} bytes)`
        //console.time(streaming_key)
        // ну тут мы сильно тоже считаем что pp это typed-array
        response.end( Buffer.from(pp.buffer) );
        //console.log("local-pusha: streaming out",urla.pathname,filePath,"bytes:",stat.size,"to",request.socket.remoteAddress)

        response.on('finish',() => {
          //console.timeEnd(streaming_key)
        })

      } catch (err) {
          response.writeHead(500, { 'Content-Type': 'text/plain'} );
          response.end( err.message )
          console.error( err )
      }
    }

}

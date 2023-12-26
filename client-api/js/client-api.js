// вебсокет клиентское апи для яваскрипт

import WebSocket from 'ws';

import req_init from "./req.js"
//import query_init from "./query.js"
//import query_init from "./query-websocket.js"
import query_init from "./query-tcp.js"
import payloads_init from "./payloads.js"
import payloads_inmem_init from "./payloads-inmem.js"
import promises_init from "./promises-client.js"

import cells_init from "./cells.js"

/*
let DEFAULT_EXTENSIONS = {
  "request": (rapi) => {
    let req_api = req_init( rapi, rapi.query )
    rapi.request = req_api.request.bind( req_api )
    rapi.reply = req_api.reply.bind( req_api )
  },
  "promises":(rapi) => {
      let p = promises_init( rapi, rapi.query, rapi.request )
      rapi.promises = p
      rapi.create_promise = p.create_promise.bind( p )
  }
}
*/

export function default_extensions( rapi, options ) {
    rapi.init_promises = []

    let q = query_init( rapi )
    rapi.query = q.query
    rapi.submit_direct_query_reply = q.submit_direct_query_reply // F-DIRECT
    rapi.operations.do_query_send = q.do_query_send

    let req_api = req_init( rapi, rapi.query )
    rapi.request = req_api.request.bind( req_api )
    rapi.reply = req_api.reply.bind( req_api )

    let p = promises_init( rapi, rapi.query, rapi.request )
    rapi.promises = p
    
    rapi.create_promise = p.create_promise.bind( p )
    rapi.resolve_promise = p.resolve_promise.bind(p)
    rapi.wait_promise = p.wait_promise.bind(p)
    rapi.when_all = p.when_all.bind(p)
    rapi.when_any = p.when_any.bind(p)
    rapi.add_data = p.add_data.bind(p)
    rapi.wait_all = p.wait_all.bind(p)
    rapi.get_data = p.get_data.bind(p)
    rapi.to_local_promise = p.to_local_promise.bind(p)
    

    // F-PUSHA-MSG-SUBMIT
    let submit_payload_url = options.submit_payload_url || "http://127.0.0.1:3333"
    rapi.submit_payload_url = submit_payload_url // надо рендерилке питона в кубик-программе
    let pp = payloads_init( rapi, submit_payload_url )
    rapi.submit_payload = pp.submit_payload.bind( pp )
    rapi.get_payload = pp.get_payload.bind( pp )

    rapi.get_one_payload = pp.get_one_payload.bind( pp )
    rapi.get_payloads = pp.get_payloads.bind( pp )

    let pp2 = payloads_inmem_init( rapi, submit_payload_url ) 
    rapi.submit_payload_inmem = pp2.submit_payload_inmem.bind( pp2 )
    rapi.payloads_inmem = pp2

    /// уникальное actor_id для каждого действующего лица
    // todo лучше чтобы сервер назначал
    // F-DIRECT 
    rapi.actor_id = rapi.generate_uniq_query_id("actor")

    let pp3 = cells_init( rapi )
    // вот когда я уже разберусь где плагин а где что? и где присвоения делать.
    rapi.create_cell = pp3.create_cell.bind( pp3 )
    rapi.read_cell = pp3.read_cell.bind( pp3 )
    rapi.open_cell = pp3.open_cell.bind( pp3 )
    rapi.create_link = pp3.create_link.bind( pp3 )

    // F-RUNNERS-LIST xxx
    /*
    rapi.query("runners-list").action( (msg) => {
      console.log("see runners-list",msg.list)
      rapi.runners_list = msg.list;
    })*/

    return Promise.all( rapi.init_promises )
}

/////////////////////////////////////////

import * as http_m from 'http'
import * as nf from 'node-fetch';
const httpAgent = new http_m.Agent({
    keepAlive: true, 
    timeout: 60*1000,
    scheduling: 'fifo',
    maxSockets: 64 // сколько одновременно сообщений 1 хосту мы можем посылать, было 4 сделал 64
    // P-NETWORK-OPTIMIZE
});

setInterval( () => {
  let kk = Object.keys(httpAgent.requests)
  if (kk.length > 0)
      console.log("httpAgent.requests:",kk.map( k => `${k} => ${httpAgent.requests[k].length}` ).join(' '))
}, 1000)



//import { HttpsProxyAgent } from 'https-proxy-agent';
//const agent = new HttpsProxyAgent('http://168.63.76.32:3128');

// https://www.npmjs.com/package/socks-proxy-agent
// https://github.com/TooTallNate/proxy-agents/tree/main/packages/socks-proxy-agent
import { SocksProxyAgent } from 'socks-proxy-agent';

// мы должны использовать сокс-прокси для доступа в другую сеть
if (process.env["PPK_SOCKS_LOCK"]) {
  let PPK_SOCKS_LOCK = process.env["PPK_SOCKS_LOCK"]
  // proxy_fn - по target_url возвращает урль прокси, если он нужен для доступа к target_url из текущего местоположения
  global.proxy_fn = (target_url) => {  
      let addr = target_url.split("://")[1]
      if (addr.startsWith("127.0"))
          return PPK_SOCKS_LOCK // доступ из УМТ к лок. машине..
  }
  // СМ ТАКЖЕ starter.js там переопределяется для машины пользователя - global.proxy_fn
}

if (process.env["PPK_SOCKS_LOCK2"]) {
  let PPK_SOCKS_LOCK2 = process.env["PPK_SOCKS_LOCK2"]
  // proxy_fn - по target_url возвращает урль прокси, если он нужен для доступа к target_url из текущего местоположения
  global.proxy_fn = (target_url) => {  
      let addr = target_url.split("://")[1]
      if (!addr.startsWith("127.0"))
          return PPK_SOCKS_LOCK2 // доступ из УМТ к лок. машине..
  }
  // СМ ТАКЖЕ starter.js там переопределяется для машины пользователя - global.proxy_fn
}

let my_addr = process.env["PPK_PUBLIC_ADDR"] || "127.0.0.1"
function get_agent_for( url, fetch_opts ) {
  let proxy_fn = global.proxy_fn // ужасный хак, но пока так
  if (proxy_fn) {
    let proxy_addr = proxy_fn( url )
    // console.log("proxy_addr computed:",proxy_addr,"for url",url)
    if (proxy_addr)
        return get_or_create_agent_on( proxy_addr )
  }  
  //url_addr = url.split("://")[1]
  return httpAgent
}

let proxy_agents={}
function get_or_create_agent_on( socks_proxy_url ) {
  proxy_agents[socks_proxy_url] ||= new SocksProxyAgent(
    socks_proxy_url,
    {
      keepAlive: true, 
      timeout: 60*1000,
      scheduling: 'fifo',
      maxSockets: 4 // сколько одновременно сообщений 1 хосту мы можем посылать
    }
  );
  return proxy_agents[socks_proxy_url]
}

/* добавляет агента с кипалайвами 
     и правильным сокс-прокси настроенным
   добавляет обход бага ноды  
*/
global.fetch = (url,opts={}) => {
  //console.log("GGG",url)
  //console.trace()
  //opts.agent = httpAgent;
  //console.log('fetch',url,opts)
  //console.log({nf})
  //  есть "мы".
  //  есть целевой узел куда мы отправляем (или читаем откуда)
  //  сообразно нужна фунция адреса для коннект-прокси..
  
  //let proxy_addr = find_proxy_for_url()
  opts.agent = get_agent_for( url, opts )

  //if (Array.isArray(url)) url = url.join("/")
//  console.log("in-fetch: agent.requests=",Object.keys(opts.agent?.requests).map( k => `${k} => ${opts.agent.requests[k].length}` ))

  //let r = nf.default( url, opts )  
  return fetch_bugfixed( url, opts )  
}

/* обходим баги ноды
https://github.com/node-fetch/node-fetch/issues/1735
https://github.com/nodejs/node/issues/47130
*/
global.fetch_bugfixed = (url,opts={}) => {
  //console.trace()
  return new Promise( (res,rej) => {
    try_fetch(10)
    function try_fetch( attempts_left ) {
      //console.log("try_fetch: calling node-fetch for url",url )
      
      let r = nf.default( url, opts )
      // оказывается их надо в цепочку собирать.. а r.catch путь неверный.. хмх
      // https://github.com/nodejs/node/issues/43326 
      r.then( result => res( result )).catch( err => {
        console.log("fetch: error",err,"url=",url)
        if (attempts_left <= 0) {
          console.log("fetch: no more attempts_left",attempts_left)
          rej( err )
        } else {
          console.log("fetch: retrying, attempts_left=",attempts_left)
          // отложим на след так т.к. в этом мы типа итак в цикле обработки находимся
          // и повторная ошибка нас вовсе сваливает..
          setTimeout( () => {
            try_fetch( attempts_left-1 )
          },1)
        }
      })
    }
  })
}

////////////////////////////////////////////////

let counter = 0;

//import url from 'node:url';

import {ClientApi,compute_need_id} from './api-lib.js'
export {compute_need_id};

// sender - идентификатор клиента. по уму это client_id. ну пока так
export function connect( sender, connection_options={}, verbose=false ) {
  console.log("connect called",connection_options)

  if (typeof(connection_options) == "string")
     connection_options = { url: connection_options }

  let {url, proxy_fn, init_extensions } = connection_options
  url ||= "ws://127.0.0.1:10000"
  init_extensions ||= default_extensions

  let ws_fn = (url) => new WebSocket( url,
      { perMessageDeflate: false,
        skipUTF8Validation: true,
        maxPayload: 200*1024*1024,
        handshakeTimeout: 5000
      } );

  let rapi = new ClientApi( ws_fn, global.fetch, sender, url, verbose )

  rapi.operations = {}  

  let extensions_p = init_extensions( rapi, connection_options )

  return new Promise( (resolve,reject) => {

    rapi.ws.on("error",(err) => {
      console.log("ws client connection error. reason:",err)
      reject(err)
    })
    
    rapi.ws.on("close",(err) => {
      console.log("ws client connection closed. reason:",err)
      // reject(err)
    })

    rapi.ws.on('open', () => {
      extensions_p.then( () => resolve( rapi ) )
      // запросим важное - что всем всегда надо
      // exec-request.. ну типа это воркерам надо.. ну странно ))))
      /* убрал - оптимизация когда и так все должно быть норм
      rapi.get_list('exec-request').then( list => {
        //console.log('exec-request resolved!')
        resolve( rapi )
      })
      */
    })

  })    
}


export function prefix_console_log( fn ) {
  var originalConsoleLog = console.log;
  console.log = function() {
      let args = fn();
      // Note: arguments is part of the prototype
      for( var i = 0; i < arguments.length; i++ ) {
          args.push( arguments[i] );
      }
      originalConsoleLog.apply( console, args );
  };
}

export function mk_console_verbose( be_verbose ) {
  if (be_verbose)
  console.verbose = function() {
      console.log.apply( console, arguments );
  };
  else
  console.verbose = () => {}
}
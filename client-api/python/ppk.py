#!/bin/env python3.9

# Клиентское апи PPK на питоне

"""
ideas: ppk.react( c1, c2, ..., fn ) по аналогии с ppk.bind
"""

import cloudpickle

import asyncio
import websockets
import uuid
import aiohttp
from aiohttp import web
from aiohttp_socks import ProxyConnector # https://pypi.org/project/aiohttp-socks/

import json
from typing import Callable

import marshal
import inspect
import traceback

# вообще спорно. ну ладно. для get_payload надо
import numpy as np

import ppk.ppk_query as ppk_query
import ppk.ppk_query_for as ppk_query_for
#import ppk_payloads
import ppk.ppk_payloads_shmem2 as ppk_payloads
import ppk.ppk_link as ppk_link
import ppk.ppk_task as ppk_task
import ppk.ppk_request as ppk_request
import ppk.sync_async_queue_v2 as sync_async_queue
#import ppk.sync_async_queue_v3 as sync_async_queue


from ppk.ppk_starter import *
from ppk.ppk_cells import *

#import web7.lib as grlib
#import web7.lib as gui

import ppk.local_channel as local

########################################## помощник запуска системы
# F-PYTHON-START-HELPER
import ppk.main as ppk_main

# походу пьесы пока что проще все импортировать?
# import ppk.main as ppk_main

# запускает клиент и при необходимости сервер
# передает управление в user_fn(rapi)
# server_url - к какому серверу подключаться. если не указать сервер будет запущен.
# port - порт для запуска сервера, 0 для выбора свободного
def start( user_fn, server_url=None, port=0):
    async def main():
        rapi = Client()
        nonlocal server_url        
        if server_url is None:
            s = ppk_main.Server()
            print("starting system")
            s1 = await s.start(port)
            print("system started")
            server_url = s.url
            # необходимо остановить сервер когда запросят остановку rapi
            rapi.atexit(s.exit)

        print("connecting to system")
        
        await rapi.connect( url=server_url )
        print("connected")
        try:
            if asyncio.iscoroutinefunction(user_fn):
                await user_fn( rapi )
            else:
                user_fn( rapi )
        finally:
            await rapi.exit()
            
    # asyncio печать исключений https://superfastpython.com/asyncio-log-all-exceptions/
    #def exception_handler(loop, context):
    #  # log exception
    #  print(context['exception'])
    # get the event loop
    #loop = asyncio.get_running_loop()
    # set the exception handler
    #loop.set_exception_handler(exception_handler)
    
    # см debug=True далее

    asyncio.run( main() )#, debug=True )

########################################## рабочее, todo удалить

# todo это видимо лишнее
# 1 запуск системы или не надо - 2 подключение к системе и переход к функции
# , main_url="ws://127.0.0.1:10000"
def ppk_run(main_fn, main_url="ws://127.0.0.1:10000"):
    c = Client( main_url )
    asyncio.run( ppk_run_a(main_fn,c) )

async def ppk_run_a(main_fn, client):
    t1 = await client.connect()    
    #t1 = asyncio.create_task( client.run() )
    t2 = asyncio.create_task( main_fn(client) )
    await asyncio.gather( t1,t2 )

"""
async def main(rapi):
    await rapi.reaction( "test", rapi.python( f ))
    print("calling msg")
    await rapi.msg( {"label":"test"} )
    #await rapi.exit()

ppk_run( main )
"""

#F-WITH
""" не работает а жаль
import contextlib
@contextlib.contextmanager
def react( channel ):
    def react_fn(msg):
        yield msg
    return channel.react( react_fn )
"""    

###########################################

# необходимо чтобы переиспользвать имеющиеся подключения
class SessionGenerator:

    def __init__(self,rapi):
        conn = aiohttp.TCPConnector(limit=1024)
        #self.default_session = aiohttp.ClientSession(timeout=5, connector=conn)
        self.default_session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout( sock_connect=5), connector=conn)
        self.sessions = {} # ключ - ip-адрес цели, но тогда много записей. можно еще ключ сделать адрес сокс
        self.rapi = rapi
        self.rapi.atexit( self.close_sessions )

    # надо закрыть иначе петон плачет
    async def close_sessions(self):
        await self.default_session.close()
        for s in self.sessions.values():
            await s.close()

    # по урлю возвращает объект сессии для работы с этим урлем
    def get_session( self,target_url ):
        #return self.default_session
        addr = target_url.split("://")[1]
        found_session = self.sessions.get( addr )
        if found_session is not None:
            return found_session
        
        socks_url = self.socks_addr( addr )
        #print("target_url=",target_url,"socks_url=",socks_url)
        if socks_url is None:
            self.sessions[addr] = self.default_session
            return self.default_session

        connector = ProxyConnector.from_url(socks_url)
        # todo разобраться с пулом, https://github.com/romis2012/aiohttp-socks/blob/master/aiohttp_socks/connector.py
        session = aiohttp.ClientSession(read_bufsize=2**25,auto_decompress=False,
            timeout=aiohttp.ClientTimeout( sock_connect=5),connector=connector)
        self.sessions[addr] = session
        return session

    # реализует алгоритм подключения сокс-прокси
    def socks_addr(self,addr):
        socks_url = os.environ.get('PPK_SOCKS_LOCK')
        #print("ENV PPK_SOCKS_LOCK=",socks_url,"addr=",addr)
        inside_user_machine = os.environ.get('PPK_USER_MACHINE')
        if socks_url is not None: # указан сокс                        
            if inside_user_machine is not None: # мы на машине пользователя
                #print("iiinside user machina")
                if not addr.startswith("127.0"):
                    return socks_url
            else: # мы на суперкомпьютере
                #print("iinside umt,",addr.startswith("127.0"))
                if addr.startswith("127.0"):
                    return socks_url
        return None


# сюда будут добавлять do_query_send
class Operations:
    def __init__(self,rapi):
        self.rapi = rapi
        self.clients = {}


###################################################
###################################################
###################################################

# идея https://github.com/dask/distributed/blob/main/distributed/scheduler.py#L161
DEFAULT_EXTENSIONS = {
    "sync_async_queue": sync_async_queue.Feature,
    "channels": ChannelFeature,
    "link": ppk_link.LinkFeature,

    "tasks": ppk_task.AsyncTasksFeature,
    "promises": ppk_task.PromisesFeature,
    "payloads": ppk_payloads.Payloads,
    "payloads_inmem": ppk_payloads.PayloadsInmem,

    "query": ppk_query.QueryTcp,
    "request" : ppk_request.RequestReplyFeature,    
    "query_for": ppk_query_for.QueryFor,    
}

# список реакций на исходящие сообщения для заданной темы 
class ReactionsList:

    def __init__(self):
        #self.topic = topic
        #self.list = initial_list # почему-то это у нас (ключ -> реакция)
        # пока так. там еще бы changed надо мб
        self.list = {}
        self.is_inited = asyncio.Future()
        self.added   = local.Channel()
        self.removed = local.Channel()
        self.inited  = local.Channel()

    def init(self,initial_list):
        self.list = initial_list
        self.is_inited.set_result(True)        
        self.inited.put(1)
        # нам надо послать сообщения
        #for id in self.list.keys():
        #    self.added(id)
        # это дорого. лучше inited 1 раз

    # здесь reaction есть результат entry_to_reaction
    def add(self,id,reaction):
        self.list[id] = reaction
        self.added.put(id)

    def remove(self,id):
        del self.list[id]
        self.removed.put(id)

    # посылка для одной реакции
    # вообще выгоднее сразу всем послать и потом всех ждать
    async def list_msg_to_one(self,recipient_reaction_id,value):
        #print("list_msg_to_one: ",recipient_reaction_id)
        if not recipient_reaction_id in self.list:
            return
        r = self.list[ recipient_reaction_id ]
        f = r["action"]["fn"]
        #f = recipient_reaction["action"]["fn"]
        res = f(value)
        if inspect.isawaitable( res ):
            await res # запуск отправки

    # посылка сообщения в список
    # ну может не list_msg а что-то другое. но пока так
    async def list_msg(self,value):
        #print("list_msg: keys=",self.list.keys())        
        reactions = self.list.values()
        await self.is_inited
        res_arr = []
        for r in reactions:
            f = r["action"]["fn"]
            res = f( value )
            if inspect.isawaitable( res ):
                res_arr.append( res )

        # ждем асинхронные операции
        await asyncio.gather( *res_arr )

class Client:

    def __init__(self,sender="python", extensions_list=DEFAULT_EXTENSIONS):
        #self.main_url = url
        self.sender = sender
        self.lists = {}
        self.operations = Operations( self )
        self.verbose = False
        self.client_id = self.mkguid()

        self.function_counter = 0
        self.exit_callbacks = []        
        self.exited = False

        # todo перетащить это в фичу local_channel
        self.local_channel = local.Channel
        
        # а вообще странно. мы идем всегда локально. так может таки пусть пуша нам говорит свой урль?
        # а не мы за нее решаем
        # process.env["PAYLOAD_NODE_URL"]

        #self.loop = self.connect()
        self.extensions = {}

        # ну пока по сути я просто задал возможность определения таблицы внешним образом.. ну ок..
        for name, extension in extensions_list.items():
            self.extend( name, extension )            

    def extend( self, extension_name, extension_func):
        self.extensions[extension_name] = extension_func( self )

    def on_open(self,wsapp):
        if self.verbose:
            print("rapi: connected")
        #self.on_open_cb()

    def on_message(self, message):
        #if self.verbose:
        #    print("message:",message)
        obj = json.loads( message )
        if self.verbose:
            print("incoming message",obj)
        if "cmd_reply" in obj and obj["cmd_reply"] == "begin_listen_list":
            mlist = { rec[0] : self.entry_to_reaction(rec[1]) for rec in obj["entries"] }
            #rlist = ReactionsList( list )
            rlist = self.get_list_now( obj["crit"] )
            rlist.init( mlist )
            #self.lists[ obj["crit"] ].set_result( rlist )
        if "opcode" in obj and obj["opcode"] == "set":
            #q = self.lists[ obj["crit"] ].result()
            q = self.get_list_now( obj["crit"] )
            #print("ppk client: new listener arrived",obj["crit"],obj["arg"]["name"],"---> messages will be sent")
            q.add( obj["arg"]["name"], self.entry_to_reaction( obj["arg"]["value"] ) )
            # надо послать микрособытие о подключении
        if "opcode" in obj and obj["opcode"] == "delete":
            #q = self.lists[ obj["crit"] ].result()
            q = self.get_list_now( obj["crit"] )
            q.remove( obj["arg"]["name"] )            

    def on_error(self, wsapp, err):
        print("Websocket error encountered: ", err)    

    async def connect(self,url="ws://127.0.0.1:10000"):
        self.main_url = url
        self.ws = None
        while self.ws is None:
            try:
                # F-PING-TM
                self.ws = await websockets.connect( self.main_url, ping_timeout=None )
            except OSError as ex:
                t = 3
                print("failed to connect to system url=",self.main_url,str(ex),"restart in ",t,"seconds")
                await asyncio.sleep( t )
        #websocket.WebSocketApp(self.main_url, on_open=self.on_open, on_message=self.on_message, on_error=self.on_error)
        #wsapp = websocket.WebSocketApp("wss://testnet-explorer.binance.org/ws/block", on_message=on_message, on_error=on_error)
        #print("inside connect")
        #wsapp.run_forever(skip_utf8_validation=True) 
        #print("after")
        #self.ws

        # https://docs.python.org/3/library/asyncio-task.html#coroutine
        # Save a reference to the result of this function, to avoid a task disappearing mid-execution. The event loop only keeps weak references to tasks.
        self.t1 = asyncio.create_task(self.run())
        #print("task created: run")
        #self.t1 = asyncio.ensure_future( self.run() )

        #print("creating task")
        #asyncio.get_event_loop().create_task( self.run() )
        #print("created task")

        return self.t1

    async def run(self):
        # это было в конструкторе но перенесено сюда
        # потому что в питоне 3.12 уже требуется loop для TcpConnector
        self.session_generator = SessionGenerator( self )

        for e in self.extensions.values():
            if hasattr(e, 'run') and callable(e.run):
                e.run()

        if self.verbose:
            print("run: entering loop")
        #while True:
        #    message = await self.ws.recv()            
        #    self.on_message(message)
        try:
            async for message in self.ws:
                #print("ws message income",message)
                self.on_message(message)
        except websockets.ConnectionClosed:
            #if self.verbose:
            print("websockets.ConnectionClosed, exiting run loop")
            await self.exit() # вызовем каллбеки разные
        except Exception as e:
            print("PPK: exception on message",e)
            print(traceback.format_exc())

        if self.verbose:
            print("run: exited loop")

    async def exit(self):
        # idea если будут глюки то подождать с закрытием ws.close (см ниже)?        
        print("rapi: exit. I am", self.ws.local_address)
        #traceback.print_stack()
        #self.t1.cancel()
        if self.exited:
            return
        self.exited = True        

        print("rapi: exit: calling exit_callbacks, total",len(self.exit_callbacks))
        for x in self.exit_callbacks:
            print("... waiting exit callback",x)
            await x()
            print("... done waiting",x)
        self.exit_callbacks = []
        print("rapi: exit: callbacks finished. closing ws connection")
        await self.ws.close()
        print("rapi: exit: ws connection closed")

        # await asyncio.sleep( 0.5 ) # ждем завершения процессов и записи их потоков..

        #if self.http_query_site is not None:
        #    await self.http_query_site
        # await asyncio.sleep( 0.1 )
        #await 
        #self.ws.wait_closed()
        #await asyncio.sleep( 1 )
        #.add_done_callback(asyncio.current_task().cancel)
        # print("wait closed ok")

    def atexit( self, method ):
        self.exit_callbacks.append( method )

    #def run(self): #, on_open:Callable):
        #self.on_open_cb = on_open
        #self.ws.run_forever(skip_utf8_validation=True) 

    async def send(self,data):
        if self.exited:
            return
        j = json.dumps(data)
        return await self.ws.send( j ) #www

    #   начать слушать список name
    def begin_listen_list( self, crit ):
        #self.lists[ crit ] = asyncio.Future()
        k = { "cmd":"begin_listen_list", "crit":crit}        
        t = self.send(k)
        self.sa_queue2.add_async_item( t )
        #return self.lists[ crit ]

    """
    async def get_list( self, crit ):
        if crit not in self.lists:
          #print("self.lists[crit] is empty, going to begin_listen_list")
          await self.begin_listen_list( crit )
        return await self.lists[ crit ]
    """

    # F-GET-LIST-SYNC
    def get_list_now( self, crit):
        if not crit in self.lists:
            rlist = ReactionsList()
            self.lists[crit] = rlist
            # но надо еще послать запрос
            self.begin_listen_list( crit )
            return rlist
        return self.lists[crit]


    def mkguid(self):
        return str(uuid.uuid4()) + "[" + self.sender + "]"

########################## rapi

    # todo разнести надо msg и тему
    async def msg( self, msg ):
        if self.verbose:
            print("msg operation. msg=",msg)
        crit = msg["label"]
        rlist = self.get_list_now( crit )                
        await rlist.is_inited #self.get_list( crit )
        #print("rapi msg crit=",crit)
        #traceback.print_stack()

        await rlist.list_msg( msg )
        """
        reactions = rlist.list.values()
        #print("running reactions",reactions)
        res_arr = []
        for r in reactions:
            #print("running reaction",r)
            f = r["action"]["fn"]
            res = f( msg )
            if inspect.isawaitable( res ):
                res_arr.append( res )
            # todo отмена обработки


        # это что за красота интересно и зачем
        # но кстати это может быть затем, что там асинхронные операции отправки
        await asyncio.gather( *res_arr )
        """

    # idea разместить счетчик N прямо в реакции?
    # action - это словарь с описанием действия
    async def reaction( self, crit, action ):
        name = self.mkguid()
        #print("name=",name)
        k = { "cmd": "add_item", "crit": crit, "name": name, "value": { "action": action } }
        if self.verbose:
            print("sending reaction msg",k)
        await self.send( k )
        rhandle = { "cmd": "delete_item", "name": name, "crit":crit }
        return rhandle

    # удаление реакции
    async def delete( self, handle ):
        await self.send( handle )

    def entry_to_reaction( self,e ):
        action = e["action"]
        if "python_hex" in action:
            # это смело. и избыточно вроде как. 
            # и пока отменяется. типа делайте ссылки на себя.
            # и локально размещайте себя у нас...
            b= bytearray.fromhex( action["python_hex"])
            g=lambda x: -1
            g.__code__ = marshal.loads( b )
            action["fn"] = g
        elif "code" in action:
            code = action["code"]
            arg = action["arg"]
            #if code in dir(self.operations):
            # вот основное. тут пересылка и передача по ссылке! должны быть
            if hasattr( self.operations, code ):
                operation_fn = getattr( self.operations, code )
            else:
                operation_fn = lambda a,b: print("operation not defined! code=",code)
            #print("qqqq!",operation_fn)
            action["fn"] = lambda msg : operation_fn(msg, arg)
        return e

    def operation( self, code, lang_env="python",**args ):
        return {"code": code, "arg":args, "lang_env":lang_env }

    # вообще так-то не очень хорошо - смешивать аргументы, там конфликты будут.
    # быть может стоит их отдельно подавать, и даже вовсе: exec_request( task, args )
    # крепко подумать
    def python( self, func, **kwargs):
        #c = func.__code__
        #bytes = marshal.dumps( c ).hex()
        
        if "python_needa" not in dir(func):
            print("ppk.python: compiling",func)
            bytes = cloudpickle.dumps( func ).hex()
            pn = self.operation( "compile-python",hex=bytes,info=str(func) )
            pn["need"] = True
            func.python_needa = pn

        python_needa = func.python_needa #внедрили ниду данной функции

        if "ppk_counter" not in dir(func):
              func.ppk_counter = self.function_counter
              self.function_counter = self.function_counter+1

        python_needa["id"] = "ppk.python_" + str(func.ppk_counter) + self.client_id
        #return self.js( "args => args.python_func( args )", python_func=python_needa, **kwargs )

        return self.operation( "compute", func=python_needa, lang_env="python",**kwargs )

    def js( self, func_str, **kwargs):
        return self.operation( self.operation("js", text=func_str, lang_env="js" ), **kwargs )

    def skip_payloads( self, payload_promisa):
        #return payload_promisa

        if payload_promisa is None:
            return None
        #print("payload_promisa=",payload_promisa)
        pn = self.operation("skip-payloads", p=payload_promisa )
        pn["id"] = "skip-payloads-"+payload_promisa["id"]
        pn["need"] = True
        pn["simple"] = True
        return pn

    # указание использовать буфер указанной промисы
    # если он развернут на воркере. либо создать такой же по аналогии
    def reuse( self, input_promise,alloc=False ):

        if input_promise is None:
            return None
        #print("payload_promisa=",payload_promisa)
        pn = self.operation("reuse-payloads", input_promise=input_promise,input_promise_id=input_promise["id"],alloc=alloc )
        pn["id"] = "reuse-payloads-"+input_promise["id"]
        pn["need"] = True
        if alloc: # если можно аллоцировать то эту ниду не надо особото учитывать в назначениях
           pn["simple"] = True
        # новое понимание - эти reuse они однократные, так что их всяко не получится учитывать
        # pn["simple"] = True
        pn["consider"] = False
        return pn
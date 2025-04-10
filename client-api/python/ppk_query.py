"""
Коммуникация query и т.п.
"""

import asyncio
import json
import os
import aiofiles
import atexit 
import traceback
import inspect
# вообще спорно. ну ладно. для get_payload надо
import numpy as np
import sys
import time

#F-PACK-SEND = эксперимент с серизализацией значений
# здесь мы сериализатор выясняем на основе типа объекта
# и упаковываем значения перед передачей в сеть, и при приёме из нее

# вообще тут может быть на будущее сокет имеет смысл передать
def serialize_for_network(msg):
    if "value" in msg:
        v = msg["value"]
        if isinstance(v, np.ndarray):
            msg = msg.copy()
            del msg["value"]
            msg["payload"] = v.tobytes()
            msg["decoder"] = dict(type="array",etype=str(v.dtype),len=len(v),shape=v.shape)
            #todo optimize - совместить с payload чтобы 2 раза сообщение не копировать
    return msg


# old: s--- 4 байта длина строки, 4 байта длина attach, и далее строка с json и массив байт attach
# 4 байта query_id, 4 байта длина строки, и далее строка с json 
class QueryTcp:

    def make_query_id(self):
        self.query_id_cnt = self.query_id_cnt + 1
        return self.query_id_cnt

    def __init__(self,rapi):
        self.query_callbacks = {}
        self.results_url_promise = None
        self.verbose = rapi.verbose
        self.rapi = rapi
        rapi.query = self.query

        self.query_id_cnt = 0
        #self.send_cnt = 0

        self.clients = {}
        rapi.operations.do_query_send = self.do_query_send
        rapi.get_incoming_endpoint = self.get_incoming_endpoint

    async def do_query_send( self,msg, arg):

        target_url = arg["results_url"]

        # F-TRACK-MSG
        if msg["label"] != "online_logging_msg" and msg["label"] != "online_logging":
            # вроде как нет нужны в этом msgid
            # "msgid":f"{self.rapi.client_id}#{self.send_cnt}",
            msg["tr_id"] = {"actor":self.rapi.sender, "t":time.time()}
            #print("ppk: added tr_id mark",msg["tr_id"])
            #msg["tr_tm"] = time.time()
            #self.send_cnt = self.send_cnt + 1

        #print("do_query_send called, arg=",arg)
        # Локальная передача данных в своем процессе
        recepient_client_id = target_url["client_id"] if "client_id" in target_url else None
        #print("recepient_client_id=",recepient_client_id,"self.rapi.client_id=",self.rapi.client_id)
        if recepient_client_id == self.rapi.client_id:
            #cb = self.query_callbacks[ arg["query_id"] ]
            # print("TARGET IS SAME! query_id=",arg["query_id"],"label=",msg["label"])
            await self.on_packet( arg["query_id"], msg )
            return

        #F-PACK-SEND эксперимент с серизализацией значений
        msg = serialize_for_network(msg)

        # print("do_query_send called",msg,arg)
        
        attach = None
        sending_msg = msg
        if "payload" in msg:
            attach = msg["payload"]
            #if "tobytes" in attach:
                #attach = attach.tobytes()
            # #F-SENDING-KEEP-PAYLOAD надо сохранять payload в оригинальном сообщении т.к. его еще будут посылать может быть
            # поэтому мы делаем копию сообщения
            # todo возможно тут это излишне - копию уже сделали в канале        
            orig_msg = msg
            sending_msg = msg.copy()
            del sending_msg["payload"]

        query_id_bytes = arg["query_id"].to_bytes(4,"big")
        #packet = {"query_id": arg["query_id"],  "m": msg } ыыы
        s = json.dumps( sending_msg )
        # print("do_query_send: encoded packet is len:",len(s))
        bytes = s.encode()
        #print("bytes="=)
        msglen = len(bytes)
        len_bytes = msglen.to_bytes(4,"big")

        attach_len = 0 if attach is None else len(attach)
        attach_len_bytes = attach_len.to_bytes(4,"big")

        client = await self.get_client_tcp( target_url )
        # print("sending as tcp client",target_url,msglen)#,"=",len(len_bytes),"attach=",attach_len_bytes)
        
        client.write( query_id_bytes )
        client.write( len_bytes )
        #print("ppk_query: sent message with attach of len",attach_len)
        client.write( attach_len_bytes ) # #F-MSGFORMAT-V2
        client.write( bytes )
        if attach is not None:
            #print("FAIL! attaches not supported")
            # #F-MSGFORMAT-V2
            client.write( attach )
            # получается attach это должно быть что-то что можно писать в tcp
            # типа bytes или bytesarray
            # https://docs.python.org/3/library/stdtypes.html#bytes

        #client.write( b''.join([len_bytes,bytes]) )
        # было, убрали
        #await client.drain()

    async def get_client_tcp( self,url ):
        surl = url["url"]
        if surl not in self.clients:
            p = asyncio.Future()
            self.clients[ surl ] = p
            #print("create client tcp, url=",url)
            reader, writer = await asyncio.open_connection(url["host"], url["port"])
            p.set_result( writer )
        pp = self.clients[ surl ]
        await pp
        return pp.result()

    # запускает сервер входящих сообщений
    # возвращает endpoint для получения сообщений
    async def get_incoming_endpoint(self):
        if self.results_url_promise is None:    
            self.results_url_promise = asyncio.Future()

            host = os.environ.get('PPK_PUBLIC_ADDR')
            if host is None:
                host = "127.0.0.1"

            self.server = await asyncio.start_server( self.on_connected,host )

            # https://docs.aiohttp.org/en/stable/web_lowlevel.html#run-a-basic-low-level-server

            adr = self.server.sockets[0].getsockname()
            
            #if host == "::1":
            #    host = "127.0.0.1"
            sadr = "tcp://" + adr[0] + ":" + str(adr[1])
            #print("query: msg server started:",adr,flush=True)
            self.results_url_promise.set_result( {"url":sadr,"host":adr[0],"port":adr[1],"client_id":self.rapi.client_id} )
            
            # https://github.com/python/cpython/blob/main/Lib/asyncio/base_events.py#L380
            task = asyncio.create_task( self.server.serve_forever() )
            #print("created task ttt",task)
            async def close_site():
                
                #print("ppk_query: close_site - stopping q", task)
                """
                print("stopping server",dir(self.server), self.server.sockets )

                for s in self.server.sockets:
                    print("s=",dir(s))
                    s.shutdown()
                """
                task.cancel()
                try:
                    #print("enter task await, server =",self.server)
                    #print("methods=",dir(self.server))
                    # короче это ток в питоне 3.13 #todo
                    #self.server.close_clients() # hack см https://github.com/python/cpython/issues/123720
                    await task
                    self.server.close()
                    await self.server.wait_closed()
                    #print("task await done is_serving()=",self.server.is_serving())
                except asyncio.CancelledError:                    
                    #print("stopping q done - CancelledError")
                    return

            self.rapi.atexit( close_site )
            # см также 
            # https://www.roguelynn.com/words/asyncio-graceful-shutdowns/            

        result = await self.results_url_promise
        return result

    async def query( self, crit, callback, N=-1):
        #print("query called",crit)
        url = await self.get_incoming_endpoint()
        query_id = self.make_query_id()
        # логика авто-отписки
        async def n_callback(msg):
            try:
                res = callback(msg)
                # хм видимо res это вызывает ожидание
                if inspect.isawaitable(res):
                    #print("it is awaitable, entering await")
                    await res
            except:
                print("-----------------------------")
                print("query: exception in callback! crit=",crit,"callback=",callback)
                # stderr
                traceback.print_exc() 
                # stdout
                print(traceback.format_exc())   
                print("-----------------------------")

            nonlocal N,rhandle
            N = N - 1            
            if N == 0:               
               await self.rapi.delete( rhandle )

        self.query_callbacks[query_id] = n_callback
        rhandle = await self.rapi.reaction( crit, self.rapi.operation("do_query_send",query_id=query_id,results_url=url) )
        return rhandle

    # присоединился новый клиент
    async def on_connected(self,reader, writer):
        #print("connected",dir(reader))

        while True:
            try:
                # #F-MSGFORMAT-V2
                data = await reader.readexactly(4)
                data2 = await reader.readexactly(4)
                data3 = await reader.readexactly(4)
            except Exception as ex:
                if not reader.at_eof():
                    print("error reading reader. at eof=",reader.at_eof(),"err=",ex)
                return
            except GeneratorExit as ex:
                #print("GeneratorExit")
                return
            except asyncio.CancelledError:
                #print("Got CancelledError")
                return
            except:
                #print("Caught it!")
                #print("Unexpected error:", sys.exc_info()[0])
                return

            query_id = int.from_bytes(data,"big")
            len = int.from_bytes(data2,"big")
            len_att = int.from_bytes(data3,"big")
            #len_att = 0
            #print("query_id=",query_id,"len=",len,hex(len),"len_att=",len_att)
                        
            if len == 0:
                print("strange incoming len=0! data=",data)
            data = await reader.readexactly(len)
            s = data.decode("utf-8")
            if not isinstance( s,str):
                print("strange decoded str, not string!data=",data,"str")
            if not s:
                print("strange decoded str len=0, btw data=",data)

            attach = None
            #print("ppk_query: incoming message attach len=",len_att)
            if len_att > 0:                
                attach = await reader.readexactly(len_att)

            await self.on_message( query_id, s,attach )

    # пришел ответ на квери
    async def on_message(self,query_id, msg_text,attach=None):
        packet = json.loads(msg_text)
        await self.on_packet( query_id, packet, attach )

    async def on_packet( self, query_id, packet, attach=None):
        cb = self.query_callbacks[ query_id ]
        m = packet
        if attach is not None:
            m["payload"] = attach
        
        if self.rapi.verbose:
            print("query got message:",packet,"cb=",cb)

        if "tr_id" in m:
            trid = m["tr_id"]
            #print("ppk: see tr_id mark",trid)
            tlen = time.time() - trid["t"]
            # todo это тупняк конечно.. надо например указать причину отправки..
            # или хотябы имена каналов
            if trid["actor"] != self.rapi.sender:
                await self.rapi.msg({"label":"online_logging_msg","value":{"task":"send","actor":trid["actor"],"actor_tgt":self.rapi.sender,"tlen":tlen,"t1":trid["t"],"dy":0}})
        
        res = cb(m)
        # хм видимо res это вызывает ожидание
        if inspect.isawaitable(res):
            #print("it is awaitable, entering await")
            await res

"""
# 4 байта длина строки и далее строка с json
class QueryTcp_v1:

    def __init__(self,rapi):
        self.query_callbacks = {}
        self.results_url_promise = None
        self.verbose = rapi.verbose
        self.rapi = rapi
        rapi.query = self.query
        self.clients = {}
        rapi.operations.do_query_send = self.do_query_send        

    # tcp
    async def do_query_send( self,msg, arg):

        target_url = arg["results_url"]
        
        # print("do_query_send called",msg,arg)
        packet = {"query_id": arg["query_id"],  "m": msg }
        s = json.dumps( packet )
        bytes = s.encode()
        #print("bytes="=)
        msglen = len(bytes)
        len_bytes = msglen.to_bytes(4,"big")

        client = await self.get_client_tcp( target_url )
        #print("sending as tcp client",target_url,len_bytes,bytes)
        
        client.write( len_bytes )
        client.write( bytes )
        #client.write( b''.join([len_bytes,bytes]) )
        await client.drain()

    async def get_client_tcp( self,url ):
        surl = url["url"]
        if surl not in self.clients:
            p = asyncio.Future()
            self.clients[ surl ] = p
            #print("create client tcp, url=",url)
            reader, writer = await asyncio.open_connection(url["host"], url["port"])
            p.set_result( writer )
        pp = self.clients[ surl ]
        await pp
        return pp.result()


    # todo идея: with
    # т.е. async with ppk.query("some") as msg:
    # ну или кстати сделать как итератор, for ...
    async def query( self, crit, callback, N=-1):
        #print("query called",crit)
        if self.results_url_promise is None:
            #print("b1")
            self.results_url_promise = asyncio.Future()

            host = os.environ.get('PPK_PUBLIC_ADDR')
            if host is None:
                host = "127.0.0.1"            

            self.server = await asyncio.start_server( self.on_connected,host )

            # https://docs.aiohttp.org/en/stable/web_lowlevel.html#run-a-basic-low-level-server

            adr = self.server.sockets[0].getsockname()
            
            #if host == "::1":
            #    host = "127.0.0.1"
            sadr = "tcp://" + adr[0] + ":" + str(adr[1])
            #print("query: msg server started:",adr,flush=True)
            self.results_url_promise.set_result( {"url":sadr,"host":adr[0],"port":adr[1],"client_id":self.rapi.client_id} )
            
            task = asyncio.create_task( self.server.serve_forever() )
            async def close_site():
                #print("stopping q")
                task.cancel()
                #print("stopping q done")
            self.rapi.atexit( close_site )

        await self.results_url_promise # ибо там нре сразу же

        url = self.results_url_promise.result()
        #print("url resolved",url)
        query_id = self.rapi.mkguid()

        self.query_callbacks[query_id] = callback

        return await self.rapi.reaction( crit, self.rapi.operation("do_query_send",query_id=query_id,results_url=url) )

    async def on_connected(self,reader, writer):
        while True:
            try:
                data = await reader.readexactly(4)
            except Exception as ex:
                print("error reading reader. at eof=",reader.at_eof(),"err=",ex)
                return

            len = int.from_bytes(data,"big")
            
                        
            if len == 0:
                print("strange incoming len=0! data=",data)
            data = await reader.read(len)
            s = data.decode("utf-8")
            if not isinstance( s,str):
                print("strange decoded str, not string!data=",data,"str")
            if not s:
                print("strange decoded str len=0, btw data=",data)
            await self.on_message( s )

    # пришел ответ на квери
    async def on_message(self,msg_text):
        packet = json.loads(msg_text)

        cb = self.query_callbacks[ packet["query_id"] ]
        m = packet["m"]
        #print(packet,"cb=",cb)
        res = cb(m)
        # а нам ето надо?
        if inspect.isawaitable(res): 
            await res

class QueryHttp:

    def __init__(self,rapi):
        self.query_callbacks = {}
        self.results_url_promise = None
        self.verbose = rapi.verbose

        self.rapi = rapi        
        rapi.query = self.query

        self.clients = {}
        rapi.operations.do_query_send = self.do_query_send

    # ну это клиентская операция
    async def do_query_send_http( self,msg, arg):

        target_url = arg["results_url"]
        
        # print("do_query_send called",msg,arg)
        packet = {"query_id": arg["query_id"],  "m": msg }
        s = json.dumps( packet )
        # https://docs.aiohttp.org/en/stable/client_quickstart.html#more-complicated-post-requests
        # print("do_query_send: packet=",packet,"to url",target_url)
        # https://docs.aiohttp.org/en/stable/client_reference.html
        session = self.rapi.session_generator.get_session( target_url )
        async with session.post( target_url, data=s ) as response:
            #print("Status:", response.status)
            pass

    # todo идея: with
    # т.е. async with ppk.query("some") as msg:
    # ну или кстати сделать как итератор, for ...
    async def query( self, crit, callback, N=-1):
        #print("query called",crit)
        if self.results_url_promise is None:
            #print("b1")
            self.results_url_promise = asyncio.Future()

            # https://docs.aiohttp.org/en/stable/web_lowlevel.html#run-a-basic-low-level-server

            server = web.Server(self.on_query_arrive)
            runner = web.ServerRunner(server)
            await runner.setup()
            #app = web.Application()
            #app.add_routes([web.get('/', self.on_query_arrive)])
            #runner = web.AppRunner(app)
            #await runner.setup()

            host = os.environ.get('PPK_PUBLIC_ADDR')
            if host is None:
                host = "127.0.0.1"

            site = web.TCPSite(runner, host=host, port=0)
            # если указать тут localhost то будет и ipv6 протокол

            await site.start()

            adr = site._server.sockets[0].getsockname()
            
            #if host == "::1":
            #    host = "127.0.0.1"
            adr = "http://" + adr[0] + ":" + str(adr[1])
            #print("query: msg server started:",adr,flush=True)
            self.results_url_promise.set_result( adr )
            #self.http_query_site = site
            async def close_site():
                #print("stopping q")
                await site.stop()
                #print("stopping q done")
            self.rapi.atexit( close_site )

        url = self.results_url_promise.result()
        #print("url resolved",url)
        query_id = self.rapi.mkguid()

        self.query_callbacks[query_id] = callback

        return await self.rapi.reaction( crit, self.rapi.operation("do_query_send",query_id=query_id,results_url=url) )

    # пришел ответ на квери
    async def on_query_arrive(self,request):
        #print("on_query_arrive")
        packet = await request.json()

        cb = self.query_callbacks[ packet["query_id"] ]
        m = packet["m"]
        #print(packet,"cb=",cb)
        res = cb(m)
        if inspect.isawaitable(res): 
            await res
        #print("cb called")
        return web.Response(text="ok")


class QueryWebsocket:

    def __init__(self,rapi):
        self.query_callbacks = {}
        self.results_url_promise = None
        self.verbose = rapi.verbose

        self.rapi = rapi        
        rapi.query = self.query
        self.clients = {}
        rapi.operations.do_query_send = self.do_query_send        

    # websocket
    async def do_query_send_ws( self,msg, arg):

        target_url = arg["results_url"]
        
        # print("do_query_send called",msg,arg)
        packet = {"query_id": arg["query_id"],  "m": msg }
        s = json.dumps( packet )

        client = await self.get_client_ws( target_url )
        #print("sending as websocket client",target_url,client)
        await client.send( s )

    async def get_client_ws( self,url ):
        if url not in self.clients:
            p = asyncio.Future()
            self.clients[ url ] = p
            cli = await websockets.connect(url,compression=None)
            p.set_result( cli )
        pp = self.clients[ url ]
        await pp
        return pp.result()        

    # todo идея: with
    # т.е. async with ppk.query("some") as msg:
    # ну или кстати сделать как итератор, for ...
    async def query( self, crit, callback, N=-1):
        #print("query called",crit)
        if self.results_url_promise is None:
            #print("b1")
            self.results_url_promise = asyncio.Future()

            host = os.environ.get('PPK_PUBLIC_ADDR')
            if host is None:
                host = "127.0.0.1"            

            self.ws_server = await websockets.serve( self.on_connected,host,compression=None )

            # https://docs.aiohttp.org/en/stable/web_lowlevel.html#run-a-basic-low-level-server

            adr = self.ws_server.sockets[0].getsockname()
            
            #if host == "::1":
            #    host = "127.0.0.1"
            adr = "ws://" + adr[0] + ":" + str(adr[1])
            #print("query: msg server started:",adr,flush=True)
            self.results_url_promise.set_result( adr )
            
            task = asyncio.create_task( self.ws_server.serve_forever() )
            async def close_site():
                #print("stopping q")
                task.cancel()
                #print("stopping q done")
            self.rapi.atexit( close_site )

        await self.results_url_promise # ибо там нре сразу же

        url = self.results_url_promise.result()
        #print("url resolved",url)
        query_id = self.rapi.mkguid()

        self.query_callbacks[query_id] = callback

        return await self.rapi.reaction( crit, self.rapi.operation("do_query_send",query_id=query_id,results_url=url) )

    async def on_connected(self,client):
        async for message in client:
            await self.on_message( message )

    # пришел ответ на квери
    async def on_message(self,msg_text):
        packet = json.loads(msg_text)

        cb = self.query_callbacks[ packet["query_id"] ]
        m = packet["m"]
        #print(packet,"cb=",cb)
        res = cb(m)
        # а нам ето надо?
        if inspect.isawaitable(res): 
            await res
"""


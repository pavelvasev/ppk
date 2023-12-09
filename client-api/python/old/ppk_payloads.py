"""
Работа с нагрузками
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
from aiohttp import web
from aiohttp_socks import ProxyConnector # https://pypi.org/project/aiohttp-socks/

class Payloads:
    def __init__(self,rapi):
        self.rapi = rapi
        self.payload_node_url = "http://127.0.0.1:3333"
        x = os.environ.get("PUSHA_URL")
        if x is not None:
           self.payload_node_url = x
        #rapi.payloads = self
        rapi.submit_payload = self.submit_payload        
        rapi.submit_payloads = self.submit_payloads
        rapi.get_payload = self.get_payload
        rapi.get_payloads = self.get_payloads

    #### submit

    # несколько штучек
    async def submit_payloads( self, data ):
        res = []
        for d in data:
            s = self.submit_payload( d )
            res.append( s )
        done = await asyncio.gather( *res ) # таки там таски или нет?
        return done

    async def get_payloads( self, payload_info_arr ):
        res = []
        for d in payload_info_arr:
            s = self.get_payload( d )
            res.append( s )
        done = await asyncio.gather( *res ) # таки там таски или нет?
        return done

    # пока 1 штучка
    async def submit_payload( self, data ):
        #print("submit_payload: data=",data)

        url = "http://127.0.0.1:3333"
        session = self.rapi.session_generator.default_session # железно без socks...
        #session = self.rapi.session_generator.get_session( url )
        #print("using session",session)
        #async with aiohttp.ClientSession() as session:
        #session = aiohttp.ClientSession()
            
        bytes = data.tobytes() # np..

        item_type = "Float64Array" # todo func
        item_shape = str(data.shape)
        item_dtype = str(data.dtype)
        bytes_count = len( bytes ) # F-PAYLOAD-BYTES-COUNT
        async with session.post( url, data=bytes ) as response:
            #print("Payload upload Status:", response.status)
            t = await response.text()

            #print("Payload upload text:", t )
            result = {
                "url": self.payload_node_url + t,
                "type": item_type,
                "shape": item_shape,
                "dtype": item_dtype,
                "bytes_count": bytes_count,
                "numpy": True # пока так
            }
            print("uploaded to url", result["url"])
            return result

    async def get_payload_by_req( self, payload_info):
        f = asyncio.Future()
        def cb(result):
            bytes = result["attach"]
            typ = payload_info["dtype"]
            dt = np.dtype( typ )
            print("get_payload_by_req: payload_info=",payload_info,"type=",dt," bytes len=",len(bytes),"payload_info=",payload_info)
            arr = np.frombuffer(bytes, dtype=dt)

            f.set_result( arr )

        print("entering get_payload_by_req",payload_info["req_msg"] )
        await self.rapi.request( payload_info["req_msg"], cb )
        await f
        return f.result()


        print("entering get_payload_by_req",payload_info["req_msg"] )
        await self.rapi.request( payload_info["req_msg"], cb )
        await f
        return f.result()        

    async def get_payload( self, payload_info ):
        #print("@get_payload, payload_info=",payload_info,flush=True)
        url = payload_info["url"] #xxx

        if "req_msg" in payload_info:
            return await self.get_payload_by_req( payload_info )

        session = self.rapi.session_generator.get_session( url )
            
        #"http://127.0.0.1:3333"
        async with session.get( url ) as response:
            #print("Payload get Status:", response.status)
            bytes = await response.read()
            typ = payload_info["dtype"]
            dt = np.dtype( typ )
            print("get_payload: url=",url,"type=",dt," bytes len=",len(bytes),"payload_info=",payload_info)
            arr = np.frombuffer(bytes, dtype=dt)
           
            return arr

# храним данные у себя, выдаем по http - играем роль пуши. точнее это пуша делегирует нам свои полномочия частично. 
# т.е. это представитель пуши
"""
class PayloadsInmem:
    def __init__(self,rapi):
        self.rapi = rapi
        self.payload_node_url = "http://127.0.0.1:3333"
        x = os.environ.get("PUSHA_URL")
        if x is not None:
           self.payload_node_url = x
        #rapi.payloads = self
        rapi.submit_payload_inmem = self.submit_payload        
        rapi.submit_payloads_inmem = self.submit_payloads
        self.payloads = {}
        self.server_promise = None
        self.id_counter = 0

    #### submit

    # несколько штучек
    async def submit_payloads( self, data ):
        res = []
        for d in data:
            s = self.submit_payload( d )
            res.append( s )
        done = await asyncio.gather( *res ) # таки там таски или нет?

        done_objs = [ x[0] for x in done]
        done_cleanups = [ x[1] for x in done]

        async def cleanup_inmem():
            for x in done_cleanups:
                await x()

        return done_objs, cleanup_inmem

    async def get_server_info(self):
        if self.server_promise is None:
            # todo тут все как в query
            #print("b1")
            self.server_promise = asyncio.Future()

            # https://docs.aiohttp.org/en/stable/web_lowlevel.html#run-a-basic-low-level-server

            server = web.Server(self.on_request)
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
            self.server_promise.set_result( adr )
            #self.http_query_site = site
            async def close_site():
                #print("stopping q")
                await site.stop()
                #print("stopping q done")
            self.rapi.atexit( close_site )

        await self.server_promise
        url = self.server_promise.result()
        return url

    async def on_request(self,request):
        # https://docs.aiohttp.org/en/latest/web_reference.html?highlight=request#request-and-base-request
        id = int(request.raw_path[1:])
        data = self.payloads[ id ]
        #headers={"Content-Length":data.nbytes}
        # мб content-type, content-lenght
        # https://docs.aiohttp.org/en/latest/web_reference.html?highlight=response#aiohttp.web.Response
        return web.Response(body = data.tobytes())

    # пока 1 штучка
    async def submit_payload( self, data ):
        id = self.id_counter
        self.id_counter += 1
        self.payloads[ id ] = data

        url = await self.get_server_info()

        item_type = "Float64Array" # todo func
        item_shape = str(data.shape)
        item_dtype = str(data.dtype)
        bytes_count = data.nbytes # F-PAYLOAD-BYTES-COUNT

        #print("Payload upload text:", t )
        result = {
            "url": url + "/" + str(id),
            "type": item_type,
            "shape": item_shape,
            "dtype": item_dtype,
            "bytes_count": bytes_count,
            "numpy": True # пока так
        }
        print("inmem uploaded to url", result["url"])

        async def cleanup_inmem():
            # todo выпихнуть на пушу...
            print("cleanup_inmem called",id)
            del self.payloads[ id ]

        return result,cleanup_inmem
"""

# синхронная версия без async чтобы не было задержек на выдачу результата
# а то там перехватывают
class PayloadsInmem:
    def __init__(self,rapi):
        self.rapi = rapi
        self.payload_node_url = "http://127.0.0.1:3333"
        x = os.environ.get("PUSHA_URL")
        if x is not None:
           self.payload_node_url = x
        #rapi.payloads = self
        rapi.submit_payload_inmem = self.submit_payload        
        rapi.submit_payloads_inmem = self.submit_payloads
        rapi.start_payloads_inmem_server = self.start_server
        self.payloads = {}
        self.server_promise = None
        self.id_counter = 0

        self.payloads_topic = self.rapi.mkguid()
        #await self.start_server()

    #### submit

    # несколько штучек
    def submit_payloads( self, data ):
        res = []
        for d in data:
            s = self.submit_payload( d )
            res.append( s )
        #done = await asyncio.gather( *res ) # таки там таски или нет?
        done = res


        async def cleanup_inmem():
            for x in done_cleanups:
                await x()

        return done_objs, cleanup_inmem

    async def start_server(self):
        if self.server_promise is None:
            # todo тут все как в query
            #print("b1")
            self.server_promise = asyncio.Future()

            # https://docs.aiohttp.org/en/stable/web_lowlevel.html#run-a-basic-low-level-server

            server = web.Server(self.on_request)
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
            self.server_promise.set_result( adr )
            #self.http_query_site = site
            async def close_site():
                #print("stopping q")
                await site.stop()
                #print("stopping q done")
            self.rapi.atexit( close_site )

            # а еще сервим по нашему протоколу...
            await self.rapi.query( self.payloads_topic, self.on_rapi_request )

        await self.server_promise
        url = self.server_promise.result()
        return url

    async def on_rapi_request( self, msg ):
        data = self.payloads[ msg["payload_id"] ]
        # вот интересно tobytes это копия?
        await self.rapi.reply( msg, {"attach":data.tobytes()})

    async def on_request(self,request):
        # https://docs.aiohttp.org/en/latest/web_reference.html?highlight=request#request-and-base-request
        id = int(request.raw_path[1:])
        data = self.payloads[ id ]
        #headers={"Content-Length":data.nbytes}
        # мб content-type, content-lenght
        # https://docs.aiohttp.org/en/latest/web_reference.html?highlight=response#aiohttp.web.Response
        return web.Response(body = data.tobytes())

    # пока 1 штучка
    def submit_payload( self, data ):
        id = self.id_counter
        self.id_counter += 1
        self.payloads[ id ] = data

        #url = await self.get_server_info()
        url = self.server_promise.result()

        item_type = "Float64Array" # todo func
        item_shape = str(data.shape)
        item_dtype = str(data.dtype)
        bytes_count = data.nbytes # F-PAYLOAD-BYTES-COUNT

        #print("Payload upload text:", t )
        result = {
            "url": url + "/" + str(id),
            "type": item_type,
            "shape": item_shape,
            "dtype": item_dtype,
            "bytes_count": bytes_count,
            "numpy": True,
            "req_msg": {
              "label": self.payloads_topic,
              "payload_id": id
            }
        }
        print("inmem uploaded to url", result["url"])

        async def cleanup_inmem():
            # todo выпихнуть на пушу...
            print("cleanup_inmem called",id)
            del self.payloads[ id ]

        return result,cleanup_inmem

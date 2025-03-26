#!/usr/bin/env python3

# упрощенная версия моста
# todo https://websockets.readthedocs.io/en/stable/reference/asyncio/server.html#websockets.asyncio.server.basic_auth


import asyncio
import websockets
from websockets.server import serve
import ppk
#import socket
#import ppk_utils
import traceback

####################### вебсокеты + main
import json

class WebsocketReprSrv:
    def __init__(self,rapi):
        #self.rapi = ppk.Client()
        self.rapi = rapi
        self.ws_clients = {}
        self.ws_cnt = 0

    async def echo(self,websocket):
        print("ws_repr: client connected:",websocket.remote_address,flush=True)
        # список функций, которые надо вызвать при отключении клиента
        #client_finish_funcs = dict()
        # список идентификаторов процессов отслеживания
        #listening_processes = dict()

        this_ws_id = self.ws_cnt
        self.ws_cnt = self.ws_cnt + 1
        self.ws_clients[ this_ws_id ] = websocket

        active_queries = dict()

        sending_lock = asyncio.Lock()

        try:
            async for message in websocket:
                msg = json.loads(message)
                #cmd = msg["cmd"]

                if "query" in msg:
                    N = msg["opts"]["N"]
                    #outer_query_id = msg["query"]
                    crit = msg["crit"]
                    def mk_reply(outer_query_id):
                        async def on_query_reply(inmsg):
                            payload = None
                            # необходим лок тк. возможны 2 посылки
                            # и были случаи что посередине вмешивалась третья
                            async with sending_lock:
                                inmsg = ppk.ppk_query.serialize_for_network( inmsg ) #F-PACK-SEND

                                # отправим пейлоад и там будут знать, что следом придет json к нему
                                if 'payload' in inmsg:
                                    payload = inmsg['payload']
                                    del inmsg['payload']
                                    #inmsg["has_payload"] = True
                                    await websocket.send(payload)
                                    
                                resp= {"query_reply": outer_query_id, "m": inmsg}
                                #print("ws repr resp=",resp)
                                resp_txt = json.dumps( resp )
                                await websocket.send(resp_txt)
                                #if payload is not None:
                                #    await websocket.send(payload)

                        return on_query_reply

                    q = await self.rapi.query( crit,mk_reply(msg["query"]), N)
                    active_queries[ msg["query"] ] = q
                elif "query_delete" in msg:
                    q = active_queries[ msg["query"] ]
                    await self.rapi.delete( q )
                    del active_queries[ msg["query"] ]

                    #print("query_delete: not implemented")
                #elif cmd == "put":
                    #msg_to_send = msg["msg"]
                    #await self.rapi.msg( msg_to_send )
                else:                    
                    #msg["client_ip"] = websocket.remote_address[0]
                    #print("REPR MSG=",msg)
                    await self.rapi.msg( msg )
                    #print("ws_repr: invalid cmd:",cmd)

            print("ws_repr: iterator finished normally")
                #resp_txt = json.dumps( resp )
                #await websocket.send(resp_txt)
        except websockets.exceptions.ConnectionClosedOK as e:
             print(f'ws_repr: client closed ok: {e}')

        except websockets.exceptions.ConnectionClosedError as e:
             print(f'ws_repr: client closed error: {e}')             

        #except websockets.exceptions.WebSocketException as e:
        #     print(f'ws_repr: other client error: {e}')
        except Exception as e:
             print(f'ws_repr: unexpected exception:',e)
             traceback.print_exc()
             # BasicException

        finally:
            print("ws_repr: finishing client. removing it's queries. this_ws_id=",this_ws_id)
            # то что ЭТОТ клиент запрашивал - мы убираем
            for q in active_queries.values():
                await self.rapi.delete(q)
            del self.ws_clients[ this_ws_id ]
            print("ws_repr: finishing client. queries removed.")
            #self.rl.print()


    # запуск ws-сервера
    # finish_future как выставят - сервер остановится
    async def main(self,port,finish_future=None,urls_future=None):

        # запустим операцию приема сообщений
        if finish_future is None:
            finish_future = asyncio.Future()
        print("ws_repr: server start.., port=",port)        
        # todo выяснить по таймаутам
        # max_size = None убираем ограничения на размер входящих соощений
        async with serve(self.echo, "0.0.0.0", port, max_size=None) as s:
            if urls_future is not None:
                urls = []
                for x in s.sockets:
                    name = x.getsockname()
                    host = name[0]
                    if host == "0.0.0.0":
                        host = ppk.utils.get_ip_addresses()[0]                        
                    urls.append( f"ws://{host}:{name[1]}")
                print("ws_repr: server started",urls)
                urls_future.set_result( urls )

            await finish_future # ждем окончания вечности
            print("~~~~~~~~~~~~~~~~~ ws-repr see finish_future")
            

############### api в духе ppk_starter
# специальный класс, для удобства запуска WebsocketReprSrv изнутри процессов программ
# в принципе, можно обоходиться и без этого класса
import atexit
class Server:

    def __init__(self):
        self.finish_future = asyncio.Future()
        atexit.register(self.cleanup) # это системное..
        #self.rapi = rapi

    def cleanup(self):
        if not self.finish_future.done():
            self.finish_future.set_result(1)
        pass

    async def exit( self ):
        #self.finish_future.set_result(1)
        self.cleanup()
        # пододжать пока отработает
        await asyncio.sleep( 0.1 )

    async def start( self,rapi,port=0 ):
        ws = WebsocketReprSrv(rapi)
        # todo убрать это и заменить обратно на url - так удобнее клиентский вид
        # а там уже пусть connect await делает внутрях
        self.urls_future = asyncio.Future()
        # urls_future это возможность получить порт
        self.task = asyncio.create_task(ws.main(port,self.finish_future, self.urls_future),name="repr_ws")
        # пододжать пока отработает
        #await asyncio.sleep( 0.1 )
        await self.urls_future
        self.url = self.urls_future.result() [0]
        return self.task

async def main():        
    #rapi = ppk.Client()
    # нам коннект даж не нужен..
    #await rapi.connect()
    ws = WebsocketReprSrv()
    await ws.main(10002)

if __name__ == "__main__":    
    asyncio.run(main)

#!/usr/bin/env python3

# перенесен в client-api т.к. тогда удобно импортировать embeddedserver

import asyncio
import websockets
from websockets.server import serve
import ppk

####################### вебсокеты + main
import json

class WebsocketBridgeSrv:
    def __init__(self):
        self.rapi = ppk.Client()
        self.ws_clients = {}
        self.ws_cnt = 0

    # реализация операции recv_from_net
    async def on_packet( self, query_id, packet, attach=None):
        for websocket in self.ws_clients.values():
            packet["query_id"] = query_id
            resp_txt = json.dumps( packet )
            await websocket.send( resp_txt )

    async def echo(self,websocket):
        # список функций, которые надо вызвать при отключении клиента
        client_finish_funcs = dict()
        # список идентификаторов процессов отслеживания
        listening_processes = dict()

        this_ws_id = self.ws_cnt
        self.ws_cnt = self.ws_cnt + 1
        self.ws_clients[ this_ws_id ] = websocket

        try:
            async for message in websocket:
                msg = json.loads(message)
                cmd = msg["cmd"]

                if cmd == "send_to_net":
                    msg_to_send = msg["msg"]
                    target_list = msg["target_list"]
                    for t in target_list:
                        await rapi.operations.do_query_send( msg_to_send,t )                    
                elif cmd == "register_web_client":
                    r_url = rapi.get_incoming_endpoint()
                    resp = {"reply":"register_web_client","r_url":r_url,"main_url":rapi.main_url}
                    resp_txt = json.dumps( resp )
                    await websocket.send(resp_txt)
                else:
                    print("ws_bridge: invalid cmd:",cmd)

                #resp_txt = json.dumps( resp )
                #await websocket.send(resp_txt)
        except websockets.exceptions.ConnectionClosedOK as e:
            print(f'ws_bridge: client closed ok: {e}')

        except websockets.exceptions.ConnectionClosedError as e:
            print(f'ws_bridge: client closed error: {e}')            

        #except Exception as e:
        #    print(f'main: unexpected exception: {e}')

        finally:
            print("ws_bridge: client finished")
            for fn in client_finish_funcs.values():
                await fn()
            del self.ws_clients[ this_ws_id ]
            #self.rl.print()


    # запуск ws-сервера
    # finish_future как выставят - сервер остановится
    async def main(self,port,finish_future=None,urls_future=None):

        # запустим операцию приема сообщений

        if finish_future is None:
            finish_future = asyncio.Future()
        print("ws_bridge: server start.., port=",port)
        async with serve(self.echo, "0.0.0.0", port) as s:
            if urls_future is not None:
                urls = []
                for x in s.sockets:
                    name = x.getsockname()
                    #print("see sock name",name)
                    if name[0] == '0.0.0.0':
                        urls.append( f"ws://127.0.0.1:{name[1]}")
                    else:
                        urls.append( f"ws://{name[0]}:{name[1]}")
                print("ws_bridge: server started",urls)
                urls_future.set_result( urls )

            await finish_future # ждем окончания вечности
            

############### api в духе ppk_starter
# специальный класс, для удобства запуска WebsocketBridgeSrv изнутри процессов программ
# в принципе, можно обоходиться и без этого класса
import atexit
class Server:

    def __init__(self ):
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

    async def start( self,port=0 ):
        ws = WebsocketBridgeSrv()
        # todo убрать это и заменить обратно на url - так удобнее клиентский вид
        # а там уже пусть connect await делает внутрях
        self.urls_future = asyncio.Future()
        # urls_future это возможность получить порт
        self.task = asyncio.create_task(ws.main(port,self.finish_future, self.urls_future))
        # пододжать пока отработает
        #await asyncio.sleep( 0.1 )
        await self.urls_future
        self.url = self.urls_future.result() [0]
        return self.task

async def main():        
    #rapi = ppk.Client()
    # нам коннект даж не нужен..
    #await rapi.connect()
    ws = WebsocketBridgeSrv()
    await ws.main(10001)

if __name__ == "__main__":    
    asyncio.run(main)

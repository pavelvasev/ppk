#!/usr/bin/env python3

# перенесен в client-api т.к. тогда удобно импортировать embeddedserver

import asyncio
import websockets
from websockets.server import serve

class ReactionsList:
    def __init__(self):
        self.table = dict()
        # ключ в table это критерий crit
        # значения в таблице - это словари значений
        # ключ в этих словарях это уникальный идентификатор

        self.listeners = dict() #идентификаторы подписчиков
        self.listeners_id = 0

    def print(self):
        print( self.table )

    async def add_item( self, name, crit, value ):
        l = self.get_reactions_list( crit )
        l[name] = value

        # уведомляем процессы
        k = self.get_listeners_list( crit )        
        for fn in k.values():
            await fn( "set",name,value )

    async def delete_item( self, name, crit ):
        l = self.get_reactions_list( crit )
        value = l[name]
        del l[name]
        
        # уведомляем процессы
        k = self.get_listeners_list( crit )        
        for fn in k.values():
            await fn( "delete",name,value )

    # возвращает словарь реакций crit
    def get_reactions_list( self, crit ):
        if not crit in self.table:
            self.table[crit] = dict()
        l = self.table[crit]
        return l

    # возвращает список слушателей crit        
    def get_listeners_list( self, crit ):
        if not crit in self.listeners:
            self.listeners[crit] = dict()
        return self.listeners[crit]            

    def begin_listen_list( self, crit, fn ):
        k = self.get_listeners_list( crit )

        self.listeners_id = self.listeners_id + 1    
        k[ self.listeners_id ] = fn

        return self.listeners_id

    def end_listen_list( self, crit, id ):
        k = self.get_listeners_list( crit )
        del k[id]


####################### вебсокеты + main
import json

class WebsocketSrv:
    def __init__(self,rl):
        self.rl = rl

    async def echo(self,websocket):
        # список функций, которые надо вызвать при отключении клиента
        client_finish_funcs = dict()
        # список идентификаторов процессов отслеживания
        listening_processes = dict()

        try:

            async for message in websocket:
                msg = json.loads(message)
                cmd = msg["cmd"]
                crit = msg["crit"]
                resp = {"status":"ok", 
                        "opcode": cmd +"_reply", # todo добавить в документацию
                        "cmd_reply": cmd,
                        "crit": crit }

                if cmd == "begin_listen_list":

                    # todo сюда бы еще listening_id посадить
                    def make_list_change( crit ):
                        async def list_change( opcode, name, value ):
                          # посылаем ток если клиент не отключился
                          if websocket.close_code is None:
                              m = { "crit" : crit, "opcode": opcode, "arg" : { "name": name, "value":value }, "listening_id":listening_id }
                              m_str = json.dumps( m )
                              await websocket.send(m_str)
                        return list_change

                    listening_id = self.rl.begin_listen_list( crit,make_list_change(crit) )

                    # запомним этот факт
                    # вынужденное async
                    def make_unsub( crit, listening_id ):
                        async def do_unsub():
                            self.rl.end_listen_list( crit,listening_id )
                        return do_unsub

                    key = "listen:"+str(listening_id)
                    client_finish_funcs[ key ] = make_unsub( crit, listening_id )
                    listening_processes[ crit ] = key

                    # формат согласован:
                    entries = []
                    rlist = self.rl.get_reactions_list( crit )                    
                    for name,value in rlist.items():
                        entries.append( [name,value] )
                    resp["entries"] = entries

                elif cmd == "end_listen_list":                
                    # это совместимость со старым протоколом
                    # todo перейти на новый
                    key = "listen:"+crit
                    for keys in listening_processes[ crit ]:
                        for key in keys:
                            await client_finish_funcs[key]
                            del client_finish_funcs[key]

                elif cmd == "add_item":
                    name = msg["name"]
                    await self.rl.add_item( name, crit, msg["value"] )

                    if not "permanent" in msg:
                        def make_forget( name, crit ):
                            async def do_forget():
                                await self.rl.delete_item( name, crit)
                            return do_forget
                        client_finish_funcs[ name ] = make_forget(name,crit)

                    resp["name"] = name

                elif cmd == "delete_item":
                    name = msg["name"]
                    await self.rl.delete_item( name, crit, msg["value"] )
                    if name in client_finish_funcs:
                        del client_finish_funcs[ name ]
                else:
                    print("main: invalid cmd:",cmd)

                resp_txt = json.dumps( resp )
                await websocket.send(resp_txt)
        except websockets.exceptions.ConnectionClosedOK as e:
            print(f'main: client closed ok: {e}')

        except websockets.exceptions.ConnectionClosedError as e:
            print(f'main: client closed error: {e}')            

        #except Exception as e:
        #    print(f'main: unexpected exception: {e}')

        finally:
            print("main: client finished")
            for fn in client_finish_funcs.values():
                await fn()
            #self.rl.print()


    # запуск ws-сервера
    # finish_future как выставят - сервер остановится
    async def main(self,port,finish_future=None,urls_future=None):
        if finish_future is None:
            finish_future = asyncio.Future()
        print("main: server start.., port=",port)
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
                print("main: server started",urls)
                urls_future.set_result( urls )
                await finish_future # ждем окончания вечности
            pass

############### api в духе ppk_starter
import atexit
class EmbeddedServer:

    def __init__(self):
        #self.worker_tasks = []
        #self.processes = []
        #self.jobs_counter = 0
        #self.url = "ws://127.0.0.1:10000"
        atexit.register(self.cleanup) # это системное..

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
        ws = WebsocketSrv( ReactionsList() )
        self.finish_future = asyncio.Future()
        # todo убрать это и заменить обратно на url - так удобнее клиентский вид
        # а там уже пусть connect await делает внутрях
        self.urls_future = asyncio.Future()
        # urls_future это возможность получить порт
        self.task = asyncio.create_task(ws.main(port,self.finish_future, self.urls_future))
        # пододжать пока отработает
        await asyncio.sleep( 0.1 )
        return self.task

if __name__ == "__main__":
    ws = WebsocketSrv( ReactionsList() )
    asyncio.run(ws.main(10000))

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


### асинхр задачи

"""
# два варианта
# 1 пихаем все операции в rapi, типа rapi.add_task 2 группируем под своим именем напр rapi.tasks.add
class AsyncTasks0:

    def __init__(self,rapi):
        self.rapi = rapi
        #rapi.tasks = self
        rapi.add_data = self.add_data
        rapi.get_data = self.get_data
        rapi.exec_request = self.exec_request

    async def add_data( self,data ):
        p = self.rapi.create_promise()
        if "tobytes" in dir(data):
            if self.rapi.verbose:
                print("auto submit payload")
            k = await self.rapi.submit_payload( data )
            k["add_data_flag"] = True
            data = k
        await self.rapi.resolve_promise( p, data )
        return p

    async def get_data( self,promise ):
        # todo: если прислали массив то..
        f = await self.rapi.wait_promise( promise )
        #print("get_data called, promise=",promise,"wait_promise returned f=",f)
        data = await f
        #print("Get_data data=",data,isinstance(data, dict),type(data),"numpy" in data)
        # автоматизация подгрузки данных
        # но вообще наверное для всех пейлоадов а не только для этой..
        if isinstance(data, dict) and "numpy" in data:
            return await self.rapi.get_payload( data )
        # а что если там массив пейлоадов?    
        return data

    # вопрос как лучше 
    # exec_request(self,action,args):
    # exec_request(self,task): # где task=(action,args) или даже (code,arg) по старинке.
    async def exec_request(self,task):

        p = self.rapi.create_promise()

        #t = asyncio.create_task( self.rapi.request( {"label":"exec-request","promise":p,"id":p["id"],
        #     "action":task["code"],"arg":task["arg"]}, lambda x: True ) )
        #print("sending",{"label":"exec-request-ready","promise":p,"id":p["id"],
        #     "action":task["code"],"arg":task["arg"]})

        await self.rapi.msg( {"label":"exec-request-ready","promise":p,"id":p["id"],
             "action":task["code"],"arg":task["arg"]} )

        #await self.rapi.request( {"label":"exec-request","promise":p,"id":p["id"],
        #     "action":task["code"],"arg":task["arg"]}, lambda x: True )       

        #await self.request( {"label":"exec-request","promise":p,"action":action,"arg":args}, lambda x: True )
        return p
"""

# оптимизированная версия. Но - тогда сервер проседает и тормозит с назначением заданий.
# Но если делать 1 воркера то это просто постановка задач как бы в параллельном потоке получается..
class AsyncTasksFeature:

    def __init__(self,rapi):
        self.rapi = rapi
        #rapi.tasks = self
        rapi.add_data = self.add_data
        rapi.get_data = self.get_data
        rapi.exec_request = self.exec_request
        self.worker_tasks = [] # надо инициализировать а иначе при закрытии будет ошибка если не было воркеров

        self.queue = None
        self.rapi.atexit( self.close_workers )

    async def close_workers(self):
        for t in self.worker_tasks:
            t.cancel()

    def init_queue(self):
        if self.queue is not None:
            return    
        self.queue = asyncio.Queue()
        tasks = []
        for i in range(1):
            task = asyncio.create_task(self.worker(f'worker-{i}', self.queue))
            tasks.append(task)
        self.worker_tasks = tasks

    async def worker(self, name, queue):
        while True:
            # Get a "work item" out of the queue.
            t = await queue.get()
            await t

    # мысль а что если data разрешить иметь .payload поле? как в сообщениях.
    async def add_data( self,data,hint=None ):
        p = self.rapi.create_promise()
        if hint is not None:
            p["hint"] = hint 
        p["add_data"] = True

        if "tobytes" in dir(data):
            if self.rapi.verbose:
                print("auto submit payload")
            k = await self.rapi.submit_payload( data )
            data = { "single_payload": True, "payload_info":[k]}
        # todo вот эту проверку на байты.. верояно стоит в resolve_promise утащить..    
        await self.rapi.resolve_promise( p, data )
        return p

    async def get_data( self,promise ):
        f = await self.rapi.wait_promise( promise )
        #print("get_data called, promise=",promise,"wait_promise returned f=",f)
        data = await f
        #print("Get_data data=",data,isinstance(data, dict),type(data),"numpy" in data)
        # автоматизация подгрузки данных
        # но вообще наверное для всех пейлоадов а не только для этой..
        # мы тут numpu еще проверяли
        if isinstance(data, dict) and "payload_info" in data:
            if "single_payload" in data:
                return await self.rapi.get_payload( data["payload_info"][0] )
            return await self.rapi.get_payloads( data["payload_info"] )    
        return data

    # вопрос как лучше 
    # exec_request(self,action,args):
    # exec_request(self,task): # где task=(action,args) или даже (code,arg) по старинке.
    async def exec_request(self,task,simple=False,hint=None):
        p = self.rapi.create_promise()
        p["simple"] = simple

        m = {"label":"exec-request-ready","promise":p,"id":p["id"],
             "code":task["code"],"arg":task["arg"], "lang_env":task["lang_env"]}
        if hint is not None:
            m["hint"] = hint # тут словарь с информацией для визуализации, в произвольной форме

        k = self.rapi.msg( m )

        self.init_queue()
        self.queue.put_nowait( k )

        #t = asyncio.create_task( self.rapi.request( {"label":"exec-request","promise":p,"id":p["id"],
        #     "action":task["code"],"arg":task["arg"]}, lambda x: True ) )

        #await self.rapi.request( {"label":"exec-request","promise":p,"id":p["id"],
        #     "action":task["code"],"arg":task["arg"]}, lambda x: True )       

        #await self.request( {"label":"exec-request","promise":p,"action":action,"arg":args}, lambda x: True )
        return p        

### обещания
class PromisesFeature:    
    def __init__(self,rapi):
        self.rapi = rapi
        #rapi.promises = self
        rapi.create_promise = self.create_promise
        rapi.resolve_promise = self.resolve_promise
        rapi.wait_promise = self.wait_promise
        rapi.wait = self.wait_promise # удобное
        rapi.when_all = self.when_all
        rapi.when_any = self.when_any
        rapi.when_all_reduce = self.when_all_reduce

    def create_promise( self, id=None ):
        if id is None:
            id = self.rapi.mkguid()
        return { "p_promise": True, "id": id }

    async def resolve_promise( self,promise, value):
        return await self.rapi.msg( {"label":"resolve-promise","promise":promise,"value":value})
        # типа а зачем нам ответ?
        #return await self.rapi.request( {"label":"resolve-promise","promise":promise,"value":value}, lambda x: True )

    async def wait_promise( self,promise ):
        f = asyncio.Future()
        def on_response(value):
            # вопрос а надо ли нам тут payload преобразовывать обратно?
            if "p_error" in dir(value):
                f.set_exception( value.error )
            else:
                f.set_result( value )
        await self.rapi.request( {"label":"wait-promise","promise":promise}, on_response )
        return f

    async def when_all(self,list):
        p = self.create_promise()
        p["simple"] = True
        await self.rapi.msg( {"label":"when-all","promise":p,"list":list} )
        # ну вот это вроде точно на тасках можно делать
        # кстати таски.. может и rapi предоставить..
        #await self.rapi.request( {"label":"when-all","promise":p,"list":list}, lambda x: True )
        return p

    async def when_any(self,list):
        p = self.create_promise()
        p["simple"] = True
        await self.rapi.msg( {"label":"when-any","promise":p,"list":list} )
        #await self.rapi.request( {"label":"when-any","promise":p,"list":list}, lambda x: True )
        return p

    async def when_all_reduce(self,list):
        p = self.create_promise()
        p["simple"] = True
        await self.rapi.msg( {"label":"when-all-reduce","promise":p,"list":list} )
        # ну вот это вроде точно на тасках можно делать
        # кстати таски.. может и rapi предоставить..
        #await self.rapi.request( {"label":"when-all","promise":p,"list":list}, lambda x: True )
        return p        

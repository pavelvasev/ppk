"""
F-PYTHON-SYNC 
реализует возможность постановки "асинхронных" заданий в синхронном виде

F-PYTHON-SYNC-V2
при реализации выяснилось что удобно иметь синхронные списки, см get_list_now 
но оказалось что тогда нужно иметь 2 очереди или рекурсивную очередь (add_async_item)
ибо нам при создании нового списка нужно посылать запрос. 
а это может происходит во время channel.submit
итого получается в rapi ну пусть будет 2 списка.. например.. 
очередей синхронных-асинхронных.
"""

import asyncio
import traceback

class Feature:

    def __init__(self,rapi):
        self.rapi = rapi
        self.rapi.sa_queue1 = SyncAsyncQueue(rapi,"sa_queue1")
        self.rapi.sa_queue2 = SyncAsyncQueue(rapi,"sa_queue2")
        self.rapi.add_async_item = self.rapi.sa_queue1.add_async_item

    def run(self):
        self.rapi.sa_queue1.run()
        self.rapi.sa_queue2.run()

class SyncAsyncQueue:

    def __init__(self,rapi,title):
        self.rapi = rapi
        self.title = title
        self.sync_async_queue = asyncio.Queue()

    # run вызывают внешне, когда клиент создан и цикл создан
    def run(self):        
        self.task = asyncio.create_task( self.process() )
        self.rapi.atexit( self.stop )

    async def stop(self):
        self.task.cancel()

    def add_async_item(self,item):
        #print(self.title,": add item",item)
        self.sync_async_queue.put_nowait( item )
        #asyncio.create_task( item )

    async def process(self):
        #print("sync_async_queue: process start")
        while True:            
            #print(self.title,": waiting new item")
            item = await self.sync_async_queue.get()
            #print("####QSIZE=",self.sync_async_queue.qsize())
            #print(self.title,": got item, awaiting",item)
            try:
                #print("-----> await begin")
                await item
                #print("-----> await end")
                #print(self.title,": item awaited OK",item)
            except Exception as error:
                # handle the exception
                print(self.title,"ppk: exception occurred:", error) # An exception occurred: division by zero
                print(self.title,"traceback:",traceback.format_exc())
            #print("sync_async_queue: item await DONE")

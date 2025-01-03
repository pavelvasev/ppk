"""
F-PYTHON-SYNC
реализует возможность постановки "асинхронных" заданий в синхронном виде
"""

import asyncio
import traceback

class Feature:

    def __init__(self,rapi):
        self.rapi = rapi
        self.rapi.sync_async_queue = asyncio.Queue()
        self.rapi.add_async_item = self.add_async_item

    def run(self):
        self.task = asyncio.create_task( self.process() )
        self.rapi.atexit( self.stop )

    async def stop(self):
        self.task.cancel()

    def add_async_item(self,item):
        print("sync_async_queue: add item",item)
        self.rapi.sync_async_queue.put_nowait( item )

    async def process(self):
        #print("sync_async_queue: process start")
        while True:
            print("sync_async_queue: getting item")
            item = await self.rapi.sync_async_queue.get()
            print("sync_async_queue: got item, awaiting",item)
            try:
                await item
                print("sync_async_queue: item awaited OK",item)
            except Exception as error:
                # handle the exception
                print("ppk: exception occurred:", error) # An exception occurred: division by zero
                print("traceback:",traceback.format_exc())
            #print("sync_async_queue: item await DONE")

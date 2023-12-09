#!/bin/env python3.9

# а кстати идея может это и есть интерфейс для команды добавить-вычисление
# ну т.е. оно локально создается и в него накидывается
class TaskAssignProcess:

    def __init__(self, rapi):
        self.rapi = rapi

    def add_task( task_msg):
        pass


"""
// получать задачи
// есть стало быть некая входящая очередь
// есть стало быть и некие параметры для рекламы себя любимого
// и есть стало быть параметр - куда слать полученные задачи.
// подразумевается что это будет использоваться конечно локально
// но в целом должно быть без разницы.
"""
class TaskQueryProcess:

    def __init__(self, rapi, outgoung_queue):
        self.rapi = rapi
        self.outgoung_queue = outgoung_queue
        # по идее.. вот мы запрашиваем tasks, а нам в ответ дадут задач

    async def query_tasks(self):
        await self.rapi.request( {"label":"tasks"}, self.add_tasks, 10)

    async def add_tasks( self, tasks):
        for t in tasks:
            t["label"] = self.outgoung_queue
            await self.rapi.msg( t )
            #self.rapi.msg( {"label":self.outgoung_queue, "value":t})

    def set_limits( self,limits):
        pass

    def added_needs( self, new_expanded_needs):
        pass

    def removed_needs( self, new_removed_needs):
        pass

# отслеживает готовность задач - согласно промисам
# есть входящая очередь - туда слать задачи
# ну и видимо есть исходящая очередь - туда посылаются разрезолвленные задачи..
class TaskResolveProcess:

    async def __init__(self, rapi, target_queue):
        self.rapi = rapi
        self.target_queue = target_queue
        self.queue = "py-trp-" + self.rapi.mkguid()
        self.waiting={}
        await self.rapi.query( self.queue, self.add_task)

    def add_task( self, msg ):
        self.waiting[ msg.id ] = asyncio.create_task( self.wait_input_ready(msg) )

    async def wait_input_ready( self, msg ):
        g_input_promisa = msg.arg.input
        local_input_promisa = await self.rapi.wait_promise( g_input_promisa )
        await local_input_promisa
        del self.waiting[ msg.id ]
        msg["label"] = self.target_queue
        await self.rapi.msg( msg )
        #await self.rapi.msg( {"label":self.target_queue,"value":msg})


class TaskExecutorProcess:

    def __init__(self, rapi):
        self.rapi = rapi        

import asyncio

"""
todo
- канал на чтение и на запись
- операция отмены чтения
- объект-связь! и сообразно операция пересылки, по аналогии с do_query_send
"""

# по мотивам WritingCell
class WritingChannel:

    def __init__(self,rapi,id):
        self.rapi = rapi
        self.id = id

    async def submit( self, value ):
        await self.rapi.msg( { "label": self.id, "value": value})


class ReadingChannel:

    def __init__(self,rapi,id):
        self.rapi = rapi
        self.id = id

        #async with self.rapi.query( self.id ) as msg:

    async def read(self):
        async for msg in self.rapi.query_for( self.id ):
            yield msg


class Channel:

    def __init__(self,rapi,id):
        self.rapi = rapi
        self.id = id

    async def submit( self, value ):
        await self.rapi.msg( { "label": self.id, "value": value})

    async def read(self):
        async for msg in self.rapi.query_for( self.id ):
            yield msg

    async def subscribe(self, cb, N=-1):
        await self.rapi.query( self.id,cb,N )
 
""" пример:
    async for msg in obj.clicked.read():
        print("clicked! ",msg)
"""         
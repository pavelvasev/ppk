import asyncio

"""
todo
- канал на чтение и на запись
- операция отмены чтения
- объект-связь! и сообразно операция пересылки, по аналогии с do_query_send

- ppk.channel, ppk.when_all .... ? такое было конечно уже с промисами
  но тут другое..

REASON
пишем и читаем с ключем value
читаем тоже с ним иначе глупость получается - записали объект (через submit)
а в subscribe словари какие-то приходят
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
        self.value = None # эксмперимент.. переход к ячейкам

    async def submit( self, value ):
        await self.rapi.msg( { "label": self.id, "value": value})

    async def read(self):
        async for msg in self.rapi.query_for( self.id ):
            yield msg

    async def subscribe(self, cb, N=-1):
        # todo мб таки 2 функции
        def cba(msg):
          v = msg["value"] if "value" in msg else None
          self.value = v
          return cb(v)
          
        async def cba2(msg):
          if asyncio.iscoroutinefunction(cb):
            await cb(msg)
          else:
            cb(msg)
        await self.rapi.query( self.id,cba,N )
 
""" пример:
    async for msg in obj.clicked.read():
        print("clicked! ",msg)
"""         

################################################
# эксперимент
# channels есть объекты
class WhenAll():
    def __init__( self, rapi, id, *channels ):
        #self.rapi = rapi
        #self.id = id
        self.output = Channel( rapi, id )
        #self.channels_ids = channels_ids
        self.channels = channels

    async def init(self):
        # idea - вот тут видно что это не шибко то subscribe
        # а нечто общее - ppk.when_any..
        index = 0
        self.pending_mask = (2**len(self.channels))-1

        for x in self.channels:
            #print("when all subscribing to ",x.id,"index=",index)
            await x.subscribe( lambda z,index=index: self.on_val(index,x,z))
            index = index+1
        return self

    async def on_val(self,index,channel,val):
        self.pending_mask = self.pending_mask & (~(2**index))
        #print("when-all index",index,"so pending_mask",self.pending_mask,"index=",index,"pow=",2**index,"channel.id=",channel.id,"val",val)
        if self.pending_mask == 0:
            await self.do_job()

    async def do_job(self):
        vals = [x.value for x in self.channels]
        await self.output.submit( vals )
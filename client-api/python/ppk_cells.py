import asyncio

# Концепция "Каналов"

"""
todo
- попробвоать with selected.react as msg: ....
        # почему-то не сделано до сих пор, а удобное будет
        def point_selected(msg):

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


class ChannelFeature:
    def __init__(self,rapi):
        self.rapi = rapi
        rapi.channel = self.channel

    def channel( self, id ):
        print("ppk: open channel ",id)
        c = Channel( self.rapi, id )
        return c

    def cell( self,id ):
        # todo
        """
        и второй вопрос стоит это поведение ячейки:
            - ресабмит при подключении других
            - не сабмит если значение не поменялось..
            - хранит ли она очередь сообщений? в js хранит..
        """
        c = Cell( self.rapi, id )
        return c

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


# вообще странный это объект.. подписывается много раз на одно и то же
# и не подписывается если нет вызова subscribe.. что это за зверь?
# но он на то и сделан универсальный.. чтобы избежать ReadingChannel, WritingChannel
class Channel:

    def __init__(self,rapi,id):
        self.rapi = rapi
        self.id = id
        self.value = None # эксмперимент.. переход к ячейкам
        self.is_channel = True
        # update но это не ячейковость а просто кеш прочитанного значения
        # с удобным аксессором на чтение
        # можно было бы просто и спец-функцию сделать

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

    # синхронные версии submit, subscribe
    # idea - мб возвращать промису по которой можно узнать что дело сделано
    # хотя на первое время достаточно будет просто submit-ов
    # F-PYTHON-SYNC
    def put( self, value ):
        t = self.submit( value )
        self.rapi.add_async_item( t )

    # idea если N закончилось - отдельное сообщение в некий канал..
    def react( self, cb, N=-1 ):
        t = self.subscribe( cb,N )
        self.rapi.add_async_item( t )
 
""" пример:
    async for msg in obj.clicked.read():
        print("clicked! ",msg)
"""         

################################################
# эксперимент
# channels есть объекты
# а это точно whenall а не when-any? ))))
# all то это подразумевает синхронность подачи а у нас нет модели времени тут
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
            x.react( lambda z,index=index: self.on_val(index,x,z))
            index = index+1
        return self

    def on_val(self,index,channel,val):
        self.pending_mask = self.pending_mask & (~(2**index))
        #print("when-all index",index,"so pending_mask",self.pending_mask,"index=",index,"pow=",2**index,"channel.id=",channel.id,"val",val)
        if self.pending_mask == 0:
            self.do_job()

    def do_job(self):
        vals = [x.value for x in self.channels]
        self.output.put( vals )
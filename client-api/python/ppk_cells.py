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

IDEA
добавить проверку записываемых значений. можно кстати на любом уровне,
хоть канала хоть ячейки хоть вообще внешний проверяльщик. Типы, диапазоны, и пр.  

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

# todo оптимизировать - rapi.get_list однократный
class Channel:

    def __init__(self,rapi,id):
        self.rapi = rapi
        self.id = id
        self.value = None # эксмперимент.. переход к ячейкам
        self.is_channel = True
        # update но это не ячейковость а просто кеш прочитанного значения
        # с удобным аксессором на чтение
        # можно было бы просто и спец-функцию сделать

    def value_to_message( self,value):
        if isinstance(value,dict) and "payload" in value:
            # #F-PAYLOAD-PASS 
            payload = value["payload"]
            del value["payload"]
            return { "label": self.id, "value": value, "payload": payload }
        else:
            return { "label": self.id, "value": value}

    async def submit( self, value ):
        await self.rapi.msg( self.value_to_message(value) )

    # todo это видимо не надо уже
    async def read(self):
        async for msg in self.rapi.query_for( self.id ):
            yield msg

    async def subscribe(self, cb, N=-1):
        # todo мб таки 2 функции
        # todo от этого надо уходить
        def cba(msg):
          v = msg["value"] if "value" in msg else None
          
          # #F-PAYLOAD-PASS галиматья на тему пейлоадов и каналов
          # кстати также см grafix utils.js
          if "payload" in msg:
            if v is None:
                v = {}
            v["payload"] = msg["payload"]

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
        return self

    # idea если N закончилось - отдельное сообщение в некий канал..
    def react( self, cb, N=-1 ):
        t = self.subscribe( cb,N )
        self.rapi.add_async_item( t )
        def stop():
            pass
        return stop

    # удобная вещь вроде.. прочитать следующее значение..
    async def read_next( self ):
        f = asyncio.Future()
        def cb(msg):
            f.set_result(msg)
        await self.subscribe( cb,1 )
        return (await f)

    # F-EXTRA-CHANNEL-NEEDS
    def reading_cell(self):        
        # idea мб создавать новый объект а не на старом сидеть
        # ну т.е. непонятно это модификаторы или конструкторы
        #channel.value = initial_value
        #def set_value(x):
        #    channel.value = x 
        # сейчас это встроенное поведение, см выше тему value
        # надо только реакцию запустить

        #channel.react( lambda x: 1 )
        #return self

        # попробуем так
        return ReadingCell( self )

    def writing_cell(self):
        return WritingCell( self )

    def cell(self):
        return ReadingWritingCell( self )        

    """
    def put_save( self, value ):
        self.value = value
        self.has_value = True
        t = self.submit( value )
        self.rapi.add_async_item( t )
        return self

    # работаем с каналом как с ячейкой в которую будем писать и которая будет
    # посылать сообщения при подключении новых    
    def writing_cell():
        x = self.rapi.get_list_now( self.id )
        # кажется это уже перебор )))
        self.put = self.put_save

        def on_added(r_id):
            if self.has_value: # todo optimize
                x.msg_to_one( r_id, self.value )

        def on_inited(arg):
            if self.has_value:
                x.msg( self.value )

        x.added.react( on_added )
        x.inited.react( on_inited )
        # а кстати вопрос. от пусть у нас в клиенте уже есть этот список
        # получается мы ни разу не получим inited/added. и не пошлем. хм.
        # но как бы ну и что. мы при нашем put вызовем получается 
        # реакции этого уже существующего списка
    """
 
""" пример:
    async for msg in obj.clicked.read():
        print("clicked! ",msg)
"""

# ячейка для чтения
# отличается от канала тем что запоминает еще значение которое в нее писали
class ReadingCell:
    def __init__(self,channel):
        self.channel = channel
        self.id = self.channel.id
        self.has_value = False
        self.value = None
        self.channel.react(self.changed)
        self.is_channel = True

    def changed(self,value):
        self.value = value
        self.has_value = True

    # намеренно не делаем put
    # а надо.. типа если туда пишут kri_radius_change
    def put(self,value):
        self.channel.put(value)
        # это вызовет реакцию и changed, см выше
        return self

    def react(self,fn):
        return self.channel.react(fn)          

# ячейка для записи
"""
если в ячейке размещено значение, 
а затем происходит подключение слушателя(слушателей)
то им посылается это значение
"""
class WritingCell:
    def __init__(self,channel):        
        self.channel = channel
        self.id = self.channel.id
        self.is_channel = True
        self.has_value = False
        self.value = None
        self.list_waiting_value = False
        self.list = channel.rapi.get_list_now( self.channel.id )
        self.list.added.react( self.on_added )
        self.list.inited.react( self.on_inited )

        self.encoder_fn = None
        self.decoder_fn = None
        # а кстати вопрос. от пусть у нас в клиенте уже есть этот список
        # получается мы ни разу не получим inited/added. и не пошлем. хм.
        # но как бы ну и что. мы при нашем put вызовем получается 
        # реакции этого уже существующего списка

        # новинка. эта ячейка должна явно вычитывать что в нее пишут..
        # точнее ну как в нее. в ее процесс передачи информации
        # чтобы обновлять значение, которое она собралась отсылать
        # новичкам. все это странно становится
        # self.channel.react( self.update_value )

    def update_value(self,value):
        #print(self.id,"Writing cell update_value")
        self.value = value
        self.has_value = True
        if self.list_waiting_value:
            self.list_waiting_value = False
            t = self.list.list_msg( self.channel.value_to_message(self.value) )
            self.channel.rapi.add_async_item( t )

    def put(self,value):
        self.update_value( value )
        #self.value = value
        #self.has_value = True
        self.channel.put(value)
        return self

    def react(self,fn):
        return self.channel.react(fn)

    def on_added(self,r_id):
        #print(self.id,"WritingCell: new listener added, r_id=",r_id,"self.has_value=",self.has_value)
        # необходимости отдельно рассылать если у ячейки нет значения нет, 
        # т.к. это будет сделано по признаку list_waiting_value
        if self.has_value: # todo optimize            
            #print(self.id,"WritingCell: sending value to newcomer",r_id)
            msg = self.channel.value_to_message(self.value)
            t = self.list.list_msg_to_one( r_id, msg )
            self.channel.rapi.add_async_item( t )

    def on_inited(self,arg):
        #print(self.id,"WritingCell: list just inited","self.has_value=",self.has_value)
        if self.has_value:
            #self.list_waiting_value = False
            #print(self.id,"WritingCell: sending value to list")
            #msg = { "label": self.channel.id, "value": self.value}
            # todo вообще это уже странно такое отправлять. надо просто value
            #ну это следующий этап
            msg = self.channel.value_to_message(self.value)
            t = self.list.list_msg( msg )
            self.channel.rapi.add_async_item( t )
        else:
            #self.list_waiting_value = True
            # вроде как это не надо.. когда придет значение список уже будет
            pass

    # todo в дектораторы это
    # #F-ENCODING
    def set_encoder(self,encoder_fn):
        self.encoder_fn = encoder_fn
        return self
    def set_encoder(self,decoder_fn):
        self.decoder_fn = decoder_fn
        return self

# ячейка для записи и для чтения тоже
"""
если в ячейке размещено значение, 
а затем происходит подключение слушателя(слушателей)
то им посылается это значение

ячейка запоминает .value - последнее полученнное значение, для локального чтения.

если значение установили извне - она тоже запоминает.

todo оптимизировать как-то. react например на листе делать
"""
class ReadingWritingCell:
    def __init__(self,channel):        
        self.channel = channel
        self.id = self.channel.id
        self.is_channel = True
        self.has_value = False
        self.value = None
        
        self.list = channel.rapi.get_list_now( self.channel.id )
        self.list.added.react( self.on_added )
        self.list.removed.react( self.on_removed )
        self.list.inited.react( self.on_inited )

        self.encoder_fn = None
        self.decoder_fn = None
        # а кстати вопрос. от пусть у нас в клиенте уже есть этот список
        # получается мы ни разу не получим inited/added. и не пошлем. хм.
        # но как бы ну и что. мы при нашем put вызовем получается 
        # реакции этого уже существующего списка

        # новинка. эта ячейка должна явно вычитывать что в нее пишут..
        # точнее ну как в нее. в ее процесс передачи информации
        # чтобы обновлять значение, которое она собралась отсылать
        # новичкам. все это странно становится
        # self.channel.react( self.update_value )

        self.channel.react(self.changed)
        self.is_channel = True

    def changed(self,value):
        self.value = value
        self.has_value = True
    
    def put(self,value):
        self.channel.put(value)
        # это вызовет реакцию и changed, см выше
        # но вызовет как-то асинхронно чем перезатрет нам мб значения..
        self.changed(value) # посему ускорим процессы...
        # но вообще это странно и todo с этим надо разобраться
        return self        

    def react(self,fn):
        return self.channel.react(fn)

    def on_removed(self,r_id):    
        #print("RWCEll on_removed:",r_id)
        pass

    # подключился новый слушатель
    def on_added(self,r_id):
        #print("RWCEll on_added:",r_id,self.id)
        #print(self.id,"WritingCell: new listener added, r_id=",r_id,"self.has_value=",self.has_value)
        # необходимости отдельно рассылать если у ячейки нет значения нет, 
        # т.к. это будет сделано по признаку list_waiting_value
        if self.has_value: # todo optimize            
            #print(self.id,"ReadingWritingCell: sending value to newcomer",r_id)
            msg = self.channel.value_to_message(self.value)
            t = self.list.list_msg_to_one( r_id, msg )
            self.channel.rapi.add_async_item( t )

    # подключился список слушателей к нашей ячейке
    def on_inited(self,arg):
        if self.has_value:
            #print("RWCELL: on_inited, sending value to all list",self.id)
            msg = self.channel.value_to_message(self.value)
            t = self.list.list_msg( msg )
            self.channel.rapi.add_async_item( t )

    # todo в дектораторы это
    # #F-ENCODING
    def set_encoder(self,encoder_fn):
        self.encoder_fn = encoder_fn
        return self
    def set_encoder(self,decoder_fn):
        self.decoder_fn = decoder_fn
        return self


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
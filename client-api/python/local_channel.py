# Локальные каналы (т.е. для процесса, и вне сетевой среды)

class Channel:
    def __init__(self):
        self.reactions = {}
        self.rcnt = 0
        self.is_channel = True

    def put(self,value):
        for fn in self.reactions.values():
            fn(value)

    def react(self, fn ):
        myid = self.rcnt
        self.rcnt = self.rcnt + 1

        self.reactions[myid] = fn

        def mkremover(id):
            def doit():
                del self.reactions[id]
            return doit

        return mkremover( myid )


class Link:
    def __init__(self,src,tgt):
        self.unsub = src.react( lambda x: tgt.put(x) )
        # логика подключения к ячейкам - передача установленных значений...
        if hasattr(src,"value") and src.value is not None:
            tgt.put( src.value)

    def stop(self):
        self.unsub()
        self.unsub = None

def create_link( src,tgt ):
    return Link( src,tgt )

def bind( src,tgt ):
    return Link( src,tgt )

# это пока простая ячейка которая хранит входящее значение
# без ресабмита при подключении других, без входящего сабмита, и без проверки изменений
class Cell(Channel):
    def __init__(self, initial_value):
        super(self)
        self.value = initial_value
        def set_value(x):
            self.value = x
        self.react( set_value )

# эксперимент
def as_cell( channel, initial_value=None ):
    channel.value = initial_value
    def set_value(x):
        channel.value = x 
    channel.react( set_value )
    return channel


class WhenAll():
    def __init__( self, *channels ):
        self.output = Channel()
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